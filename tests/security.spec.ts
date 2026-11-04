import { test, expect } from "@playwright/test";
import { getSafeRedirectUrl, getUserStorageKey } from "../src/lib/utils/security";

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
});
