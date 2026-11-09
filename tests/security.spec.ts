import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  escapeCsvCell,
  escapeHtml,
  getSafeRedirectUrl,
  getSafeRequestOrigin,
  getUserStorageKey,
  sanitizeHttpUrl,
  verifyCronSecret,
} from "../src/lib/utils/security";

test.describe("Security Tests — SaaS Hardening", () => {
  const baseUrl = "https://monbudget.app/auth/confirm";

  test("Open Redirect Prevention: blocks absolute URLs and protocols", () => {
    // Malicious external URLs
    expect(getSafeRedirectUrl("https://evil.com", baseUrl).toString()).toBe("https://monbudget.app/");
    expect(getSafeRedirectUrl("http://phishing.site/login", baseUrl).toString()).toBe("https://monbudget.app/");
    expect(getSafeRedirectUrl("//attacker.com/steal", baseUrl).toString()).toBe("https://monbudget.app/");
    expect(getSafeRedirectUrl("javascript:alert(1)", baseUrl).toString()).toBe("https://monbudget.app/");
    expect(getSafeRedirectUrl("///evil.com", baseUrl).toString()).toBe("https://monbudget.app/");
    expect(getSafeRedirectUrl("/\\attacker.com", baseUrl).toString()).toBe("https://monbudget.app/");
    expect(getSafeRedirectUrl(null, baseUrl).toString()).toBe("https://monbudget.app/");
    expect(getSafeRedirectUrl("", baseUrl).toString()).toBe("https://monbudget.app/");
  });

  test("Open Redirect Prevention: allows valid internal paths", () => {
    expect(getSafeRedirectUrl("/dashboard", baseUrl).toString()).toBe("https://monbudget.app/dashboard");
    expect(getSafeRedirectUrl("/settings?tab=profile", baseUrl).toString()).toBe("https://monbudget.app/settings?tab=profile");
    expect(getSafeRedirectUrl("/categories", baseUrl).toString()).toBe("https://monbudget.app/categories");
  });

  test("Cache Partitioning: generates user-scoped storage keys", () => {
    const user1Key = getUserStorageKey("user-uuid-1");
    const user2Key = getUserStorageKey("user-uuid-2");
    const anonKey = getUserStorageKey(null);

    expect(user1Key).toBe("monbudget_cache_user-uuid-1");
    expect(user2Key).toBe("monbudget_cache_user-uuid-2");
    expect(user1Key).not.toBe(user2Key);
    expect(anonKey).toBe("monbudget_local_cache_anon");
  });

  test("Cron Job Security: enforces Bearer token authentication", () => {
    const validSecret = "super_secret_cron_token_12345";

    // Cas A : Token invalide ou malformé
    expect(verifyCronSecret("Bearer wrong_token", validSecret)).toBe(false);
    expect(verifyCronSecret("Basic wrong_token", validSecret)).toBe(false);
    expect(verifyCronSecret("super_secret_cron_token_12345", validSecret)).toBe(false);

    // Cas B : En-tête absent ou vide
    expect(verifyCronSecret(null, validSecret)).toBe(false);
    expect(verifyCronSecret("", validSecret)).toBe(false);

    // Cas C : Secret serveur non configuré
    expect(verifyCronSecret("Bearer super_secret_cron_token_12345", undefined)).toBe(false);

    // Cas D : Token Bearer parfaitement authentique
    expect(verifyCronSecret("Bearer super_secret_cron_token_12345", validSecret)).toBe(true);
  });

  test("XSS & URL sanitization: escapeHtml and sanitizeHttpUrl neutralize payloads", () => {
    expect(escapeHtml(`<script>alert("xss")</script> & 'test'`)).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;test&#39;"
    );
    expect(escapeHtml("Frère Fidèle — Alimentation")).toBe("Frère Fidèle — Alimentation");

    expect(sanitizeHttpUrl("javascript:alert(1)")).toBe("https://monbudget.app");
    expect(sanitizeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe("https://monbudget.app");
    expect(sanitizeHttpUrl("https://monbudget.app/dashboard?tab=1")).toBe(
      "https://monbudget.app/dashboard?tab=1"
    );
  });

  test("CSV Formula Injection Prevention: blocks formula prefixes while preserving negative numbers", () => {
    expect(escapeCsvCell('=HYPERLINK("https://evil.com","Click")')).toBe(
      '"\'=HYPERLINK(""https://evil.com"",""Click"")"'
    );
    expect(escapeCsvCell("+cmd|' /C calc'!A0")).toBe('"\'+cmd|\' /C calc\'!A0"');
    expect(escapeCsvCell("-1+1")).toBe('"\'-1+1"');
    expect(escapeCsvCell("@SUM(1+1)")).toBe('"\'@SUM(1+1)"');

    // Les vrais montants numériques (y compris négatifs) restent des nombres valides dans Excel
    expect(escapeCsvCell("-15000")).toBe('"-15000"');
    expect(escapeCsvCell(-15000)).toBe('"-15000"');
    expect(escapeCsvCell("0")).toBe('"0"');
  });

  test("API Fail-Closed & Zod Validation: /api/cron/daily-check, /api/checkout & /api/checkout/status", async ({
    request,
  }) => {
    // 1. /api/cron/daily-check doit refuser (401) même si CRON_SECRET n'est pas configuré localement
    const cronRes = await request.get("/api/cron/daily-check");
    expect(cronRes.status()).toBe(401);

    // 2. /api/checkout valide les champs avec Zod (ordre invalide ou UUID malformé -> 400)
    const badOrderRes = await request.post("/api/checkout", {
      headers: { "x-forwarded-for": `ip-zod-check-${Date.now()}` },
      data: {
        testUserId: "user-zod-test",
        orderId: "not-a-valid-uuid",
      },
    });
    expect(badOrderRes.status()).toBe(400);
    expect((await badOrderRes.json()).error?.code).toBe("INVALID_PAYLOAD");

    const badPlanRes = await request.post("/api/checkout", {
      headers: { "x-forwarded-for": `ip-zod-plan-${Date.now()}` },
      data: {
        testUserId: "user-zod-test-2",
        planId: "hacked_plan",
      },
    });
    expect(badPlanRes.status()).toBe(400);

    // 3. /api/checkout/status rejette un orderId non-UUID
    const badStatusRes = await request.get(
      "/api/checkout/status?testUserId=user-zod-test&orderId=not-a-uuid"
    );
    expect(badStatusRes.status()).toBe(400);
    expect((await badStatusRes.json()).error?.code).toBe("INVALID_QUERY");
  });

  test("SQL Hardening Étape 2: private receipts bucket, CHECK constraints and paid-plan RLS", () => {
    const appHardeningSql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261111_security_hardening_app.sql"),
      "utf8"
    );
    expect(appHardeningSql).toContain("public = false");
    expect(appHardeningSql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    expect(appHardeningSql).toContain("NOT VALID");
    expect(appHardeningSql).toContain("user_has_paid_plan");
    expect(appHardeningSql).toContain("public.budget_allocations");
    expect(appHardeningSql).toContain("public.savings_goals");
    expect(appHardeningSql).toContain("public.debts");
  });

  test("Étape 3: Full Content-Security-Policy & security headers on HTTP responses", async ({
    request,
  }) => {
    const res = await request.get("/login");
    expect(res.status()).toBe(200);

    const headers = res.headers();
    const csp = headers["content-security-policy"] || "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("https://*.moneriz.com");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("https://challenges.cloudflare.com");

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
  });

  test("Étape 3: Zero client-side admin email/logic leakage and min password length >= 8", () => {
    const srcRoot = path.join(process.cwd(), "src");
    const walk = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) return [full];
        return [];
      });
    };

    const allSourceFiles = walk(srcRoot);
    const clientFiles = allSourceFiles.filter((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      return (
        content.trimStart().startsWith('"use client"') ||
        content.trimStart().startsWith("'use client'") ||
        filePath.endsWith(path.join("lib", "store", "ui-store.ts"))
      );
    });

    expect(clientFiles.length).toBeGreaterThan(5);
    for (const filePath of clientFiles) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content, `Client file leaks @/lib/utils/admin: ${filePath}`).not.toContain(
        "@/lib/utils/admin"
      );
      expect(content, `Client file leaks DEFAULT_ADMIN_EMAILS: ${filePath}`).not.toContain(
        "DEFAULT_ADMIN_EMAILS"
      );
      expect(content.toLowerCase(), `Client file leaks admin handle: ${filePath}`).not.toContain(
        "degladux"
      );
      expect(content.toLowerCase(), `Client file leaks admin email: ${filePath}`).not.toContain(
        "fideleatchade@gmail.com"
      );
    }

    for (const rel of [
      "src/app/(auth)/register/page.tsx",
      "src/app/(auth)/reset-password/page.tsx",
      "src/app/(dashboard)/settings/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(src, `${rel} must enforce 8+ chars`).toContain("minLength={8}");
      expect(src, `${rel} must validate length < 8`).toContain(".length < 8");
    }
  });

  test("Trusted Origin Resolution: preserves monbudgetpro.com via x-forwarded-host and blocks host spoofing", async ({
    request,
  }) => {
    const trustedOrigin = getSafeRequestOrigin({
      url: "https://monbudget-sable.vercel.app/auth/confirm?next=/dashboard",
      headers: new Headers({
        "x-forwarded-host": "monbudgetpro.com",
        "x-forwarded-proto": "https",
      }),
    });
    expect(trustedOrigin).toBe("https://monbudgetpro.com");

    const wwwOrigin = getSafeRequestOrigin({
      url: "https://monbudget-sable.vercel.app/auth/callback",
      headers: new Headers({
        "x-forwarded-host": "www.monbudgetpro.com",
        "x-forwarded-proto": "https",
      }),
    });
    expect(wwwOrigin).toBe("https://www.monbudgetpro.com");

    // Rejette toute tentative d'usurpation vers un domaine tiers non approuvé
    const spoofedOrigin = getSafeRequestOrigin({
      url: "https://monbudget-sable.vercel.app/auth/callback",
      headers: new Headers({
        "x-forwarded-host": "evil.com",
        "x-forwarded-proto": "https",
      }),
    });
    expect(spoofedOrigin).toBe("https://monbudget-sable.vercel.app");

    const atSpoofOrigin = getSafeRequestOrigin({
      url: "https://monbudget-sable.vercel.app/auth/confirm",
      headers: new Headers({
        "x-forwarded-host": "monbudgetpro.com@evil.com",
        "x-forwarded-proto": "https",
      }),
    });
    expect(atSpoofOrigin).toBe("https://monbudget-sable.vercel.app");

    // Test HTTP réel des routes /auth/callback et /auth/confirm
    const cbRes = await request.get("/auth/callback?error=access_denied", {
      maxRedirects: 0,
      headers: {
        "x-forwarded-host": "monbudgetpro.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(cbRes.status()).toBe(307);
    expect(cbRes.headers()["location"]).toMatch(/^https:\/\/monbudgetpro\.com\/login\?/);

    const confirmSpoofRes = await request.get("/auth/confirm?error=expired", {
      maxRedirects: 0,
      headers: {
        "x-forwarded-host": "attacker.evil.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(confirmSpoofRes.status()).toBe(307);
    expect(confirmSpoofRes.headers()["location"]).not.toContain("attacker.evil.com");
  });
});
