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
});
