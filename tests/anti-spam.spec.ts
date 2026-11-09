import { test, expect } from "@playwright/test";
import {
  checkRateLimit,
  detectSpamContent,
  escapeHtml,
  getClientIp,
  isDisposableEmail,
  resetRateLimitStore,
  sanitizeEmailHeader,
  validateHumanSubmission,
} from "../src/lib/server/anti-spam";

test.describe("Protection Anti-Spam & Anti-Bot — Tests Unitaires & API", () => {
  test.beforeEach(() => {
    resetRateLimitStore();
  });

  test("1. Blocage des adresses email jetables et autorisation des domaines légitimes", () => {
    expect(isDisposableEmail("bot@yopmail.com")).toBe(true);
    expect(isDisposableEmail("Test@YopMail.fr")).toBe(true);
    expect(isDisposableEmail("spam@mailinator.com")).toBe(true);
    expect(isDisposableEmail("quick@10minutemail.com")).toBe(true);
    expect(isDisposableEmail("sub@mail.yopmail.com")).toBe(true);

    expect(isDisposableEmail("fidele@gmail.com")).toBe(false);
    expect(isDisposableEmail("support@monbudgetpro.com")).toBe(false);
    expect(isDisposableEmail("client@outlook.fr")).toBe(false);
  });

  test("2. Piège Honeypot & détection de soumission robotisée trop rapide", () => {
    // Honeypot rempli -> bloqué
    const hpFail = validateHumanSubmission({
      honeypot: "https://spam-site.com",
      formElapsedMs: 5000,
      requireTiming: true,
    });
    expect(hpFail.ok).toBe(false);
    expect(hpFail.code).toBe("HONEYPOT_TRIGGERED");

    // Temps manquant quand requis -> bloqué
    const missingTiming = validateHumanSubmission({
      honeypot: "",
      requireTiming: true,
    });
    expect(missingTiming.ok).toBe(false);
    expect(missingTiming.code).toBe("MISSING_FORM_TIMING");

    // Soumission robotisée instantanée (200 ms) -> bloqué
    const tooFast = validateHumanSubmission({
      honeypot: "",
      formElapsedMs: 200,
      minElapsedMs: 1200,
      requireTiming: true,
    });
    expect(tooFast.ok).toBe(false);
    expect(tooFast.code).toBe("TOO_FAST_SUBMISSION");

    // Humain légitime (3.5 s, honeypot vide) -> autorisé
    const humanOk = validateHumanSubmission({
      honeypot: "",
      formElapsedMs: 3500,
      minElapsedMs: 1200,
      requireTiming: true,
    });
    expect(humanOk.ok).toBe(true);
  });

  test("3. Détection de contenu spam, XSS HTML escaping & anti-CRLF header injection", () => {
    // Message légitime avec montant et lien unique MonBudget -> accepté
    expect(
      detectSpamContent(
        "Bonjour, je veux suivre mon budget de 150000 FCFA sur https://monbudgetpro.com/debts merci."
      ).isSpam
    ).toBe(false);

    // Trop de liens -> bloqué
    expect(
      detectSpamContent(
        "Visitez https://a.example https://b.example et https://c.example maintenant"
      ).isSpam
    ).toBe(true);

    // BBCode / Script -> bloqué
    expect(detectSpamContent("[url=https://spam.biz]Cliquez ici[/url]").isSpam).toBe(true);
    expect(detectSpamContent("<script>alert(1)</script>").isSpam).toBe(true);

    // Répétition mécanique -> bloqué
    expect(detectSpamContent("aaaaaaaaaaaaaaaaaaaaaa spam").isSpam).toBe(true);

    // Échappement HTML & nettoyage d'en-tête
    expect(escapeHtml(`<img src=x onerror="alert('xss')">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;"
    );
    expect(sanitizeEmailHeader("user@test.com\r\nBcc: hacker@evil.com")).toBe(
      "user@test.com Bcc: hacker@evil.com"
    );
  });

  test("4. Rate limiting en fenêtre glissante", () => {
    const start = 1794200000000;
    const rule = { maxRequests: 2, windowMs: 60_000 };

    expect(checkRateLimit("k1", rule, start).allowed).toBe(true);
    expect(checkRateLimit("k1", rule, start + 100).allowed).toBe(true);
    const blocked = checkRateLimit("k1", rule, start + 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(59);

    // Après expiration de la fenêtre -> réautorisé
    expect(checkRateLimit("k1", rule, start + 60_001).allowed).toBe(true);
  });

  test("5. API /api/auth/anti-spam bloque honeypot, emails jetables, bots rapides et flood (429)", async ({
    request,
  }) => {
    const runSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Honeypot rempli -> 400
    const resHp = await request.post("/api/auth/anti-spam", {
      headers: { "x-forwarded-for": `ip-hp-${runSeed}` },
      data: {
        action: "register",
        email: "humain@gmail.com",
        honeypot: "http://spam.com",
        formElapsedMs: 4000,
      },
    });
    expect(resHp.status()).toBe(400);
    expect((await resHp.json()).code).toBe("HONEYPOT_TRIGGERED");

    // Email jetable à l'inscription -> 400 DISPOSABLE_EMAIL
    const resDisp = await request.post("/api/auth/anti-spam", {
      headers: { "x-forwarded-for": `ip-disp-${runSeed}` },
      data: {
        action: "register",
        email: "fake@yopmail.com",
        honeypot: "",
        formElapsedMs: 4000,
      },
    });
    expect(resDisp.status()).toBe(400);
    expect((await resDisp.json()).code).toBe("DISPOSABLE_EMAIL");

    // Bot ultra-rapide -> 400 TOO_FAST_SUBMISSION
    const resFast = await request.post("/api/auth/anti-spam", {
      headers: { "x-forwarded-for": `ip-fast-${runSeed}` },
      data: {
        action: "register",
        email: "humain@gmail.com",
        honeypot: "",
        formElapsedMs: 120,
      },
    });
    expect(resFast.status()).toBe(400);
    expect((await resFast.json()).code).toBe("TOO_FAST_SUBMISSION");

    // Humain valide + vérification rate-limit au-delà de 8 requêtes
    const floodIp = `ip-flood-${runSeed}`;
    for (let i = 0; i < 8; i++) {
      const okRes = await request.post("/api/auth/anti-spam", {
        headers: { "x-forwarded-for": floodIp },
        data: {
          action: "register",
          email: `fidele${i}@gmail.com`,
          honeypot: "",
          formElapsedMs: 3000,
        },
      });
      expect(okRes.status()).toBe(200);
    }

    const blockedRes = await request.post("/api/auth/anti-spam", {
      headers: { "x-forwarded-for": floodIp },
      data: {
        action: "register",
        email: "fidele9@gmail.com",
        honeypot: "",
        formElapsedMs: 3000,
      },
    });
    expect(blockedRes.status()).toBe(429);
    expect(blockedRes.headers()["retry-after"]).toBeTruthy();
    expect((await blockedRes.json()).code).toBe("RATE_LIMITED");
  });

  test("6. API /api/support bloque les bots, le spam de liens et applique le rate limit (429)", async ({
    request,
  }) => {
    const testIp = `ip-support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Requête brute sans timing -> 400
    const resNoTiming = await request.post("/api/support", {
      headers: { "x-forwarded-for": testIp },
      data: {
        name: "Bot Sans Form",
        email: "bot@gmail.com",
        message: "Message automatisé par script.",
      },
    });
    expect(resNoTiming.status()).toBe(400);

    // Spam multi-liens -> 400 SPAM_CONTENT_DETECTED
    const resLinks = await request.post("/api/support", {
      headers: { "x-forwarded-for": testIp },
      data: {
        name: "Spammer",
        email: "spam@gmail.com",
        message: "Offre promo https://a.com https://b.com https://c.com",
        honeypot: "",
        formElapsedMs: 4000,
      },
    });
    expect(resLinks.status()).toBe(400);
    expect((await resLinks.json()).code).toBe("SPAM_CONTENT_DETECTED");

    // 3 autres requêtes valides -> 200 (total 5 avec les 2 précédentes, donc la 6ème déclenche 429)
    for (let i = 0; i < 3; i++) {
      const okSupport = await request.post("/api/support", {
        headers: { "x-forwarded-for": testIp },
        data: {
          name: "Frère Fidèle",
          email: "fidele@gmail.com",
          topic: "Assistance générale",
          message: "Bonjour, comment configurer mon enveloppe épargne ?",
          honeypot: "",
          formElapsedMs: 4000,
        },
      });
      expect(okSupport.status()).toBe(200);
    }

    const rateLimitedSupport = await request.post("/api/support", {
      headers: { "x-forwarded-for": testIp },
      data: {
        name: "Frère Fidèle",
        email: "fidele@gmail.com",
        topic: "Assistance générale",
        message: "Encore un message trop rapproché.",
        honeypot: "",
        formElapsedMs: 4000,
      },
    });
    expect(rateLimitedSupport.status()).toBe(429);
    expect((await rateLimitedSupport.json()).code).toBe("RATE_LIMITED");
  });

  test("7. Les pages publiques (/login, /register, /forgot-password, /support) embarquent le piège Honeypot", async ({
    request,
  }) => {
    for (const route of ["/login", "/register", "/forgot-password", "/support"]) {
      const res = await request.get(route);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain('name="website_url"');
    }
  });

  test("8. API /api/checkout applique le rate limiting par IP (429)", async ({ request }) => {
    const checkoutIp = `ip-checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Les 25 premières tentatives non authentifiées reçoivent 401
    for (let i = 0; i < 25; i++) {
      const res = await request.post("/api/checkout", {
        headers: { "x-forwarded-for": checkoutIp },
        data: { planId: "personal" },
      });
      expect(res.status()).toBe(401);
    }

    // La 26ème est bloquée par anti-spam rate limit -> 429
    const limited = await request.post("/api/checkout", {
      headers: { "x-forwarded-for": checkoutIp },
      data: { planId: "personal" },
    });
    expect(limited.status()).toBe(429);
    expect((await limited.json()).error?.code).toBe("RATE_LIMITED");
  });

  test("9. Extraction IP résiste au spoofing de cf-connecting-ip lorsque les en-têtes proxy fiables sont présents", () => {
    const reqWithVercel = new Request("https://monbudget.app/api/support", {
      headers: {
        "cf-connecting-ip": "1.2.3.4",
        "x-real-ip": "198.51.100.2",
        "x-vercel-forwarded-for": "203.0.113.9, 10.0.0.1",
      },
    });
    expect(getClientIp(reqWithVercel)).toBe("203.0.113.9");

    const reqWithRealIp = new Request("https://monbudget.app/api/support", {
      headers: {
        "cf-connecting-ip": "1.2.3.4",
        "x-forwarded-for": "198.51.100.77, 10.0.0.1",
        "x-real-ip": "192.0.2.50",
      },
    });
    expect(getClientIp(reqWithRealIp)).toBe("192.0.2.50");
  });
});
