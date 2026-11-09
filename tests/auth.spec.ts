import { test, expect } from "@playwright/test";
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
});
