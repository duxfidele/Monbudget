import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { translateAuthError } from "../src/lib/utils/auth-errors";

test.describe("Authentification, Bouton Retour & Anti-Autofill — MonBudget", () => {
  test("1. /login inclut le bouton Retour à l'accueil en haut à gauche et bloque l'autofill agressif", async ({ request }) => {
    const res = await request.get("/login");
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain('aria-label="Retour à l&#x27;accueil"');
    expect(body).toContain('href="/"');
    expect(body).toContain("Retour à l&#x27;accueil");
    expect(body.toLowerCase()).toContain('autocomplete="off"');
    expect(body).toContain('name="mb_login_email"');
    expect(body).toContain('name="mb_login_password"');
  });

  test("2. /register inclut le bouton Retour à l'accueil en haut à gauche et bloque l'autofill agressif", async ({ request }) => {
    const res = await request.get("/register");
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain('aria-label="Retour à l&#x27;accueil"');
    expect(body).toContain('href="/"');
    expect(body.toLowerCase()).toContain('autocomplete="off"');
    expect(body).toContain('name="mb_reg_email"');
    expect(body.toLowerCase()).toContain('autocomplete="new-password"');
  });

  test("3. translateAuthError traduit correctement 'Database error saving new user' et les erreurs Google/Supabase", () => {
    const translated = translateAuthError("Database error saving new user");
    expect(translated).toContain("base de données");
    expect(translated).not.toBe("Database error saving new user");

    expect(translateAuthError("Invalid login credentials")).toContain("Email ou mot de passe incorrect");
    expect(translateAuthError("access_denied")).toContain("Connexion Google annulée");
  });

  test("4. L'interface intermédiaire /welcome est protégée contre l'accès anonyme (redirige vers /login)", async ({ request }) => {
    const res = await request.get("/welcome", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());
    const location = res.headers()["location"] || "";
    expect(location).toContain("/login");
  });

  test("5. Le bouton Google OAuth force l'écran consentement ('select_account consent') et passe par /welcome", () => {
    const googleBtnSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/auth/google-button.tsx"),
      "utf-8"
    );
    expect(googleBtnSrc).toContain('prompt: "select_account consent"');
    expect(googleBtnSrc).toContain("/welcome?next=");

    const callbackSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/auth/callback/route.ts"),
      "utf-8"
    );
    expect(callbackSrc).toContain('searchParams.get("next") || "/welcome"');
  });

  test("6. Onboarding 30j complet d'abord : /register et Google signup passent toujours par /welcome?next=/dashboard sans dévier vers Gratuit ni caisse directe", () => {
    const registerSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/(auth)/register/page.tsx"),
      "utf-8"
    );
    expect(registerSrc).toContain("const redirectNext = `/welcome?next=${encodeURIComponent(afterWelcome)}`");
    expect(registerSrc).not.toContain("/settings?tab=subscription&plan=");
    expect(registerSrc).toContain("30 jours d&apos;essai gratuit complet");

    const googleBtnSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/auth/google-button.tsx"),
      "utf-8"
    );
    expect(googleBtnSrc).toContain('mode !== "signup" && planParam');

    const callbackSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/auth/callback/route.ts"),
      "utf-8"
    );
    const cbStatusIdx = callbackSrc.indexOf("await getOrderAndSubscriptionStatus(");
    const cbWelcomeIdx = callbackSrc.indexOf("await sendWelcomeNotificationsOnce(");
    expect(cbStatusIdx).toBeGreaterThan(-1);
    expect(cbWelcomeIdx).toBeGreaterThan(-1);
    expect(cbStatusIdx).toBeLessThan(cbWelcomeIdx);

    const confirmSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/auth/confirm/route.ts"),
      "utf-8"
    );
    const cfStatusIdx = confirmSrc.indexOf("await getOrderAndSubscriptionStatus(");
    const cfWelcomeIdx = confirmSrc.indexOf("await sendWelcomeNotificationsOnce(");
    expect(cfStatusIdx).toBeGreaterThan(-1);
    expect(cfWelcomeIdx).toBeGreaterThan(-1);
    expect(cfStatusIdx).toBeLessThan(cfWelcomeIdx);

    for (const relPath of [
      "src/components/landing/hero.tsx",
      "src/components/landing/navbar.tsx",
      "src/components/landing/cta-section.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
      expect(src).toContain('href="/register"');
    }

    const pricingSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/landing/pricing-section.tsx"),
      "utf-8"
    );
    expect(pricingSrc).toContain('ctaHref: "/register"');
    expect(pricingSrc).toContain('ctaHref: "/register?plan=personal"');
    expect(pricingSrc).toContain('ctaHref: "/register?plan=business"');
  });
});
