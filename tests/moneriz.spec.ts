import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  canAccessFeature,
  getRequiredPlanForFeature,
  getServerPlanAmountXof,
  MONBUDGET_PLANS,
} from "../src/lib/moneriz-plans";
import {
  buildMonerizSignatureHeader,
  verifyMonerizSignature,
} from "../src/lib/server/moneriz-signature";
import {
  commitMonerizInbox,
  getOrderAndSubscriptionStatus,
  parseMonerizEvent,
  prepareAuthorizedCheckout,
} from "../src/lib/server/moneriz-app";
import {
  createMonerizCheckoutSession,
  MonerizApiError,
} from "../src/lib/server/moneriz-checkout";

test.describe("Intégration Moneriz SaaS — Tarifs, Sécurité HMAC & Machine d'États", () => {
  test("1. Grille tarifaire officielle (Gratuit, Particulier 1 000 FCFA, Entreprise 2 500 FCFA + -2 mois annuel)", () => {
    // Plan Gratuit
    expect(MONBUDGET_PLANS.free.monthlyPriceXof).toBe(0);
    expect(MONBUDGET_PLANS.free.yearlyPriceXof).toBe(0);

    // Plan Particulier : 1 000 XOF/mois et 10 000 XOF/an (2 mois offerts)
    const personalMonthly = getServerPlanAmountXof("personal", "monthly");
    expect(personalMonthly.amount).toBe(1000);
    expect(personalMonthly.currency).toBe("XOF");

    const personalYearly = getServerPlanAmountXof("personal", "yearly");
    expect(personalYearly.amount).toBe(10000);
    expect(personalYearly.currency).toBe("XOF");
    expect(MONBUDGET_PLANS.personal.yearlySavingsXof).toBe(2000);

    // Plan Entreprise : 2 500 XOF/mois et 25 000 XOF/an (2 mois offerts)
    const businessMonthly = getServerPlanAmountXof("business", "monthly");
    expect(businessMonthly.amount).toBe(2500);
    expect(businessMonthly.currency).toBe("XOF");

    const businessYearly = getServerPlanAmountXof("business", "yearly");
    expect(businessYearly.amount).toBe(25000);
    expect(businessYearly.currency).toBe("XOF");
    expect(MONBUDGET_PLANS.business.yearlySavingsXof).toBe(5000);
  });

  test("2. Restrictions par plan : Gratuit limité aux Entrées/Dépenses (sans Budget ni Épargne ni le reste)", () => {
    // Plan Gratuit : aucun accès à budget, savings, debts, reports, advisor
    expect(canAccessFeature("free", "budget")).toBe(false);
    expect(canAccessFeature("free", "savings")).toBe(false);
    expect(canAccessFeature("free", "debts")).toBe(false);
    expect(canAccessFeature("free", "reports")).toBe(false);
    expect(canAccessFeature("free", "advisor")).toBe(false);

    // Plan Particulier : débloque budget, savings, debts ; verrouille reports et advisor
    expect(canAccessFeature("personal", "budget")).toBe(true);
    expect(canAccessFeature("personal", "savings")).toBe(true);
    expect(canAccessFeature("personal", "debts")).toBe(true);
    expect(canAccessFeature("personal", "reports")).toBe(false);
    expect(canAccessFeature("personal", "advisor")).toBe(false);

    // Plan Entreprise : débloque 100% des fonctionnalités
    expect(canAccessFeature("business", "budget")).toBe(true);
    expect(canAccessFeature("business", "savings")).toBe(true);
    expect(canAccessFeature("business", "debts")).toBe(true);
    expect(canAccessFeature("business", "reports")).toBe(true);
    expect(canAccessFeature("business", "advisor")).toBe(true);

    expect(getRequiredPlanForFeature("budget")).toBe("personal");
    expect(getRequiredPlanForFeature("advisor")).toBe("business");
  });

  test("3. Vérification cryptographique HMAC-SHA256 de X-Moneriz-Signature et fenêtre anti-rejeu de 5 minutes", () => {
    const secret = "whsec_test_moneriz_secret_key_2026";
    const now = 1794055000000;
    const rawBody = JSON.stringify({
      id: "evt_01JTEST123456",
      type: "payment.succeeded",
      mode: "test",
      occurredAt: "2026-11-08T10:00:00.000Z",
      payment: {
        id: "pay_01JTEST123456",
        mode: "test",
        status: "paid",
        amount: 1000,
        currency: "XOF",
        reference: "MB-TEST-PER-123456",
        paidAt: "2026-11-08T10:00:00.000Z",
      },
    });

    const validHeader = buildMonerizSignatureHeader(rawBody, secret, now);
    expect(verifyMonerizSignature(rawBody, validHeader, secret, now)).toBe(true);

    // Rejet si le corps brut a été modifié d'un seul espace
    expect(verifyMonerizSignature(rawBody + " ", validHeader, secret, now)).toBe(false);

    // Rejet si l'horodatage dépasse la tolérance de 5 minutes (300 001 ms)
    expect(verifyMonerizSignature(rawBody, validHeader, secret, now + 5 * 60 * 1000 + 1000)).toBe(
      false
    );

    // Rejet si mauvais secret
    expect(verifyMonerizSignature(rawBody, validHeader, "wrong_secret", now)).toBe(false);
  });

  test("4. Protection des commandes (FORBIDDEN_ORDER), Idempotence, Déduplication Webhook & Cycle de vie complet", async () => {
    const userA = "user-alpha-111";
    const userB = "user-bravo-222";

    // User A prépare une commande Particulier Annuel (10 000 XOF)
    const { order } = await prepareAuthorizedCheckout({
      userId: userA,
      planId: "personal",
      billingCycle: "yearly",
      requestOrigin: "https://monbudget-sable.vercel.app",
    });

    expect(order.amount).toBe(10000);
    expect(order.currency).toBe("XOF");
    expect(order.status).toBe("pending");
    expect(order.idempotencyKey).toContain(`checkout-${order.id}`);
    expect(order.requestSnapshot.integrationMode).toBe("iframe");
    expect(order.requestSnapshot.embedOrigin).toBe("https://monbudget-sable.vercel.app");

    // User B tente d'accéder à la commande de User A -> FORBIDDEN_ORDER
    await expect(
      prepareAuthorizedCheckout({
        userId: userB,
        orderId: order.id,
      })
    ).rejects.toThrow("FORBIDDEN_ORDER");

    // Avant le webhook, l'abonnement de User A est toujours 'free'
    const beforeWebhook = await getOrderAndSubscriptionStatus({
      userId: userA,
      orderId: order.id,
    });
    expect(beforeWebhook.subscription.planId).toBe("free");

    // Réception du webhook signé payment.succeeded
    const rawEvent = JSON.stringify({
      id: `evt_success_${order.id}`,
      type: "payment.succeeded",
      mode: order.mode,
      occurredAt: new Date().toISOString(),
      payment: {
        id: `pay_${order.id}`,
        mode: order.mode,
        status: "paid",
        amount: 10000,
        currency: "XOF",
        reference: order.reference,
        paidAt: new Date().toISOString(),
      },
    });

    const parsedEvent = parseMonerizEvent(rawEvent);
    const firstCommit = await commitMonerizInbox(parsedEvent);
    expect(firstCommit.duplicate).toBe(false);
    expect(firstCommit.orderStatus).toBe("paid");
    expect(firstCommit.planId).toBe("personal");

    // Vérification de l'activation côté serveur
    const afterWebhook = await getOrderAndSubscriptionStatus({
      userId: userA,
      orderId: order.id,
    });
    expect(afterWebhook.order?.status).toBe("paid");
    expect(afterWebhook.subscription.planId).toBe("personal");
    expect(afterWebhook.subscription.billingCycle).toBe("yearly");

    // Livraison en doublon du même event.id -> ignoré proprement (idempotent)
    const duplicateCommit = await commitMonerizInbox(parsedEvent);
    expect(duplicateCommit.duplicate).toBe(true);

    // Webhook hors-séquence (ex: payment.failed tardif d'une ancienne tentative) -> ne rétrograde jamais une commande paid
    const lateFailedEvent = parseMonerizEvent(
      JSON.stringify({
        id: `evt_late_fail_${order.id}`,
        type: "payment.failed",
        mode: order.mode,
        occurredAt: new Date().toISOString(),
        payment: {
          id: `pay_old_${order.id}`,
          mode: order.mode,
          status: "failed",
          amount: 10000,
          currency: "XOF",
          reference: order.reference,
          paidAt: null,
        },
      })
    );
    const lateCommit = await commitMonerizInbox(lateFailedEvent);
    expect(lateCommit.orderStatus).toBe("paid");

    // Rejet en cas d'écart de montant (AMOUNT_OR_CURRENCY_MISMATCH)
    const mismatchedAmountEvent = parseMonerizEvent(
      JSON.stringify({
        id: `evt_bad_amt_${order.id}`,
        type: "payment.succeeded",
        mode: order.mode,
        occurredAt: new Date().toISOString(),
        payment: {
          id: `pay_bad_${order.id}`,
          mode: order.mode,
          status: "paid",
          amount: 500, // Ne correspond pas à 10 000 XOF
          currency: "XOF",
          reference: order.reference,
          paidAt: new Date().toISOString(),
        },
      })
    );
    await expect(commitMonerizInbox(mismatchedAmountEvent)).rejects.toThrow(
      "AMOUNT_OR_CURRENCY_MISMATCH"
    );
  });

  test("5. Durcissement sécurité Étape 1 : refus du fallback RAM/anon en production et verrouillage SQL RPC/RLS", async () => {
    const monerizAppSource = fs.readFileSync(
      path.join(process.cwd(), "src/lib/server/moneriz-app.ts"),
      "utf8"
    );
    // getAdminSupabase ne doit jamais retomber sur la clé publique anon
    const adminFnMatch = monerizAppSource.match(/function getAdminSupabase\(\)[\s\S]*?\n\}/);
    expect(adminFnMatch?.[0]).toBeTruthy();
    expect(adminFnMatch?.[0]).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    // En production sans SUPABASE_SERVICE_ROLE_KEY, aucun fallback RAM toléré
    const env = process.env as Record<string, string | undefined>;
    const prevNodeEnv = env.NODE_ENV;
    const prevServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    env.NODE_ENV = "production";
    delete env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      await expect(
        prepareAuthorizedCheckout({
          userId: "user-prod-guard",
          planId: "personal",
          billingCycle: "monthly",
        })
      ).rejects.toThrow("MISSING_SERVICE_ROLE_KEY");

      const prodEvent = parseMonerizEvent(
        JSON.stringify({
          id: "evt_prod_guard_1",
          type: "payment.succeeded",
          mode: "test",
          occurredAt: new Date().toISOString(),
          payment: {
            id: "pay_prod_guard_1",
            mode: "test",
            status: "paid",
            amount: 1000,
            currency: "XOF",
            reference: "MB-TEST-PER-PRODGUARD",
            paidAt: new Date().toISOString(),
          },
        })
      );

      await expect(commitMonerizInbox(prodEvent)).rejects.toThrow(
        "MISSING_SERVICE_ROLE_KEY"
      );
    } finally {
      if (prevNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = prevNodeEnv;
      if (prevServiceKey === undefined) delete env.SUPABASE_SERVICE_ROLE_KEY;
      else env.SUPABASE_SERVICE_ROLE_KEY = prevServiceKey;
    }

    // La migration SQL de durcissement doit révoquer EXECUTE public/anon/authenticated sur process_moneriz_webhook_event
    const hardeningSql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261110_security_hardening_moneriz.sql"),
      "utf8"
    );
    expect(hardeningSql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(hardeningSql).toContain('DROP POLICY IF EXISTS "Users can update their own pending orders"');
    expect(hardeningSql).toContain("FROM PUBLIC, anon, authenticated");
    expect(hardeningSql).toContain("TO service_role");
    expect(hardeningSql).toContain("FORBIDDEN_SERVICE_ROLE_REQUIRED");
  });

  test("6. Mode Liveframe strict : sans repli redirect, séparation commandes redirect/iframe, origines autorisées & successUrl /dashboard", async () => {
    const env = process.env as Record<string, string | undefined>;
    const prevEmbedOrigin = env.MONERIZ_EMBED_ORIGIN;
    const prevSecret = env.MONERIZ_SECRET_KEY;
    env.MONERIZ_EMBED_ORIGIN = "https://monbudgetpro.com";
    env.MONERIZ_SECRET_KEY = "izp_test_sk_dummy_for_unit_test";

    const originalFetch = globalThis.fetch;

    try {
      const userLiveframe = `user-liveframe-${Date.now()}`;

      // 6a. Création préalable en mode redirect puis passage à iframe -> crée une nouvelle commande sans réutiliser redirect
      const redirectAttempt = await prepareAuthorizedCheckout({
        userId: userLiveframe,
        planId: "personal",
        billingCycle: "monthly",
        requestOrigin: "https://monbudgetpro.com",
        preferredMode: "redirect",
      });
      expect(redirectAttempt.order.requestSnapshot.integrationMode).toBe("redirect");

      const iframeAttempt = await prepareAuthorizedCheckout({
        userId: userLiveframe,
        planId: "personal",
        billingCycle: "monthly",
        requestOrigin: "https://www.monbudgetpro.com",
        preferredMode: "iframe",
      });
      expect(iframeAttempt.order.id).not.toBe(redirectAttempt.order.id);
      expect(iframeAttempt.order.reference).not.toBe(redirectAttempt.order.reference);
      expect(iframeAttempt.order.requestSnapshot.integrationMode).toBe("iframe");
      expect(iframeAttempt.order.requestSnapshot.embedOrigin).toBe("https://www.monbudgetpro.com");
      expect(iframeAttempt.order.requestSnapshot.successUrl).toContain("/dashboard?orderId=");

      // 6b. Une origine non autorisée (spoofing Origin) est ignorée au profit de MONERIZ_EMBED_ORIGIN
      const spoofAttempt = await prepareAuthorizedCheckout({
        userId: `user-spoof-${Date.now()}`,
        planId: "business",
        billingCycle: "monthly",
        requestOrigin: "https://attacker.example.com",
        preferredMode: "iframe",
      });
      expect(spoofAttempt.order.requestSnapshot.embedOrigin).toBe("https://monbudgetpro.com");

      // 6c. Si Moneriz rejette embedOrigin (EMBED_ORIGIN_NOT_ALLOWED), aucun repli silencieux vers redirect
      let fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return new Response(
          JSON.stringify({
            error: {
              code: "EMBED_ORIGIN_NOT_ALLOWED",
              message: "Origin not allowed",
              requestId: "req_test_embed_denied",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch;

      await expect(
        createMonerizCheckoutSession(iframeAttempt.order)
      ).rejects.toMatchObject({
        name: "MonerizApiError",
        code: "EMBED_ORIGIN_NOT_ALLOWED",
        status: 400,
      } satisfies Partial<MonerizApiError>);
      expect(fetchCalls).toBe(1);

      // 6d. Session iframe valide conservée intacte
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            id: "cs_test_liveframe_ok",
            mode: "test",
            status: "open",
            integrationMode: "iframe",
            checkoutUrl: "https://moneriz.com/payer/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE",
            embedUrl: "https://moneriz.com/integrer/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE",
            amount: iframeAttempt.order.amount,
            currency: "XOF",
            title: iframeAttempt.order.title,
            reference: iframeAttempt.order.reference,
            expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch;

      const created = await createMonerizCheckoutSession(iframeAttempt.order);
      expect(created.usedFallbackRedirect).toBe(false);
      expect(created.session.integrationMode).toBe("iframe");
      expect(created.session.embedUrl).toContain("/integrer/");
    } finally {
      globalThis.fetch = originalFetch;
      if (prevEmbedOrigin === undefined) delete env.MONERIZ_EMBED_ORIGIN;
      else env.MONERIZ_EMBED_ORIGIN = prevEmbedOrigin;
      if (prevSecret === undefined) delete env.MONERIZ_SECRET_KEY;
      else env.MONERIZ_SECRET_KEY = prevSecret;
    }
  });

  test("7. Contrat UI Liveframe v1 & redirection immédiate vers /dashboard après paiement confirmé", () => {
    const liveframeSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/payments/moneriz-liveframe.tsx"),
      "utf8"
    );
    const widgetSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/payments/subscription-plans-widget.tsx"),
      "utf8"
    );
    const initializerSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/store-initializer.tsx"),
      "utf8"
    );

    // Liveframe ne redirige jamais silencieusement hors de l'application
    expect(liveframeSrc).not.toContain("window.location.assign");
    expect(liveframeSrc).toContain('record.source !== "moneriz"');
    expect(liveframeSrc).toContain('type: "moneriz.init"');
    expect(liveframeSrc).toContain("record.resumeUrl");
    expect(liveframeSrc).toContain("allow-popups-to-escape-sandbox");
    expect(liveframeSrc).toContain('referrerPolicy="no-referrer"');
    expect(liveframeSrc).toContain('router.push("/dashboard")');

    // Widget & retour dashboard
    expect(widgetSrc).toContain('router.push("/dashboard")');
    expect(initializerSrc).toContain('refreshSubscription(rawOrderId, validPaymentId)');
    expect(initializerSrc).toContain('router.replace("/dashboard")');
  });
});

