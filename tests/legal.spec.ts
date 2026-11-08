import { test, expect } from '@playwright/test';

test.describe('Pages Légales & Conformité Google OAuth — MonBudget (monbudgetpro.com)', () => {
  test('1. La page /terms (CGU) est publique, renvoie HTTP 200 et mentionne monbudgetpro.com', async ({ request }) => {
    const res = await request.get('/terms');
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain("Conditions Générales d&#x27;Utilisation");
    expect(body).toContain("monbudgetpro.com");
    expect(body).toContain("Moneriz");
    expect(body).toContain("Plan Gratuit");
    expect(body).toContain("Plan Particulier");
    expect(body).toContain("Plan Entreprise");
  });

  test('2. La page /privacy est publique, renvoie HTTP 200 et contient les clauses Google OAuth exigées', async ({ request }) => {
    const res = await request.get('/privacy');
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain("Politique de");
    expect(body).toContain("Confidentialité");
    expect(body).toContain("monbudgetpro.com");
    expect(body).toContain("Google API Services User Data Policy");
    expect(body).toContain("Limited Use");
    expect(body).toContain("support@monbudgetpro.com");
  });

  test('3. La page d\'inscription /register contient les liens vers /terms et /privacy', async ({ request }) => {
    const res = await request.get('/register');
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain('href="/terms"');
    expect(body).toContain('href="/privacy"');
  });

  test('4. La page de connexion /login contient les liens vers /terms et /privacy', async ({ request }) => {
    const res = await request.get('/login');
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain('href="/terms"');
    expect(body).toContain('href="/privacy"');
  });
});
