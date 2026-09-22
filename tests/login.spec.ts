import { test, expect } from '@playwright/test';

test('App should redirect to login', async ({ page }) => {
  await page.goto('/');
  // Because of the middleware, we should be redirected to /login
  await expect(page).toHaveURL(/.*login/);
  await expect(page.locator('text=Bienvenue sur MonBudget')).toBeVisible();
});
