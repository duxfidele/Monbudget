import { test, expect } from "@playwright/test";
import {
  isAdmin,
  assertAdmin,
  verifyAdminAccess,
  getAdminEmails,
  DEFAULT_ADMIN_EMAILS,
} from "../src/lib/utils/admin";

test.describe("Admin Access Control & Metrics — SaaS Governance", () => {
  test("authorizes default super-admin emails case-insensitively", () => {
    // Cas A : degladux@gmail.com
    expect(isAdmin("degladux@gmail.com")).toBe(true);
    expect(isAdmin("DEGLADUX@GMAIL.COM")).toBe(true);
    expect(isAdmin("  degladux@gmail.com  ")).toBe(true);

    // Cas B : fideleatchade@gmail.com
    expect(isAdmin("fideleatchade@gmail.com")).toBe(true);
    expect(isAdmin("FideleAtchade@Gmail.Com")).toBe(true);
  });

  test("authorizes additional admin emails via ADMIN_EMAILS environment variable", () => {
    const originalEnv = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "superadmin@monbudget.app, finance@monbudget.app";

    try {
      expect(isAdmin("superadmin@monbudget.app")).toBe(true);
      expect(isAdmin("finance@monbudget.app")).toBe(true);
      expect(isAdmin("SUPERADMIN@MONBUDGET.APP")).toBe(true);

      // Les admins par défaut restent autorisés
      expect(isAdmin("degladux@gmail.com")).toBe(true);
    } finally {
      process.env.ADMIN_EMAILS = originalEnv;
    }
  });

  test("strictly rejects non-admin users, empty strings, and nullish values", () => {
    expect(isAdmin("normal.user@gmail.com")).toBe(false);
    expect(isAdmin("hacker@evil.com")).toBe(false);
    expect(isAdmin("degladux@otherdomain.com")).toBe(false);
    expect(isAdmin("")).toBe(false);
    expect(isAdmin("   ")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  test("assertAdmin throws descriptive error for unauthorized accounts and passes for admins", () => {
    // Admin autorisé
    expect(() => assertAdmin("degladux@gmail.com")).not.toThrow();

    // Utilisateur non autorisé
    expect(() => assertAdmin("inconnu@test.com")).toThrow(
      "Accès refusé. Privilèges administrateur requis."
    );
    expect(() => assertAdmin(null)).toThrow("Accès refusé. Privilèges administrateur requis.");
  });

  test("getAdminEmails returns deduplicated, lowercased email list", () => {
    const emails = getAdminEmails();
    expect(Array.isArray(emails)).toBe(true);
    expect(emails).toContain("degladux@gmail.com");
    expect(emails).toContain("fideleatchade@gmail.com");

    // Vérifier l'absence de doublons
    const uniqueSet = new Set(emails);
    expect(uniqueSet.size).toBe(emails.length);
  });

  test("verifyAdminAccess enforces authentication and authorization contract", () => {
    // Cas A : Utilisateur non authentifié (email null ou undefined) -> 401
    const unauthNull = verifyAdminAccess(null);
    expect(unauthNull.authorized).toBe(false);
    expect(unauthNull.status).toBe(401);
    expect(unauthNull.error).toContain("Non authentifié");

    const unauthUndefined = verifyAdminAccess(undefined);
    expect(unauthUndefined.authorized).toBe(false);
    expect(unauthUndefined.status).toBe(401);

    // Cas B : Utilisateur authentifié mais non admin -> 403
    const forbidden = verifyAdminAccess("membre.lambda@gmail.com");
    expect(forbidden.authorized).toBe(false);
    expect(forbidden.status).toBe(403);
    expect(forbidden.error).toContain("Accès refusé");

    // Cas C : Super-Administrateur authentifié -> 200
    const allowed = verifyAdminAccess("degladux@gmail.com");
    expect(allowed.authorized).toBe(true);
    expect(allowed.status).toBe(200);
    expect(allowed.error).toBeUndefined();
  });

  test("server endpoints /api/auth/admin-status, /api/checkout/status & /api/admin/metrics fail closed without admin session", async ({
    request,
  }) => {
    // 1. /api/auth/admin-status renvoie false sans exposer la liste des emails
    const statusRes = await request.get("/api/auth/admin-status");
    expect(statusRes.status()).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson).toEqual({ authenticated: false, isAdmin: false });

    // 2. /api/checkout/status (en mode test hors prod) indique isAdmin: false pour un non-admin
    const checkoutStatusRes = await request.get("/api/checkout/status?testUserId=user-non-admin");
    expect(checkoutStatusRes.status()).toBe(200);
    const checkoutStatusJson = await checkoutStatusRes.json();
    expect(checkoutStatusJson.isAdmin).toBe(false);

    // 3. /api/admin/metrics (GET et POST) refusent l'accès anonyme (401)
    const metricsGetRes = await request.get("/api/admin/metrics");
    expect(metricsGetRes.status()).toBe(401);

    const metricsPostRes = await request.post("/api/admin/metrics", {
      data: {
        targetUserId: "00000000-0000-0000-0000-000000000001",
        planId: "business",
      },
    });
    expect(metricsPostRes.status()).toBe(401);
  });
});
