import { test, expect } from "@playwright/test";
import { CURRENT_APP_VERSION, APP_CHANGELOG } from "../src/lib/app-version";
import fs from "fs";
import path from "path";

test.describe("PWA Update Notification & Feature Installation System", () => {
  test("1. Versioning et Changelog officiel sont cohérents et documentent les nouveautés", () => {
    expect(CURRENT_APP_VERSION).toBe("4.2.0");
    expect(APP_CHANGELOG.length).toBeGreaterThanOrEqual(1);

    const latest = APP_CHANGELOG[0];
    expect(latest.version).toBe("4.2.0");
    expect(latest.title).toContain("Investissements");

    const hasInvestmentsHighlight = latest.highlights.some(
      (h) => h.title.includes("Investissements") || h.description.includes("investissements")
    );
    expect(hasInvestmentsHighlight).toBe(true);

    const hasFreePlanHighlight = latest.highlights.some(
      (h) => h.title.includes("Plan Gratuit") || h.description.includes("Gratuit")
    );
    expect(hasFreePlanHighlight).toBe(true);

    const hasPwaHighlight = latest.highlights.some(
      (h) => h.title.includes("PWA") || h.description.includes("PWA")
    );
    expect(hasPwaHighlight).toBe(true);
  });

  test("2. Le Service Worker (sw.js) pré-cache la route /investments et incrémente le cache v5", () => {
    const swPath = path.resolve(process.cwd(), "public/sw.js");
    const swContent = fs.readFileSync(swPath, "utf-8");

    expect(swContent).toContain("monbudget-cache-v5");
    expect(swContent).toContain('"/investments"');
    expect(swContent).toContain("Version: 4.2.0");
  });

  test("3. Le composant UpdateNotificationBanner et les routes du layout sont bien configurés", () => {
    const bannerPath = path.resolve(process.cwd(), "src/components/pwa/update-notification-banner.tsx");
    const bannerContent = fs.readFileSync(bannerPath, "utf-8");

    expect(bannerContent).toContain("CURRENT_APP_VERSION");
    expect(bannerContent).toContain("isUpdateAvailable");
    expect(bannerContent).toContain("applyAppUpdate");
    expect(bannerContent).toContain("installPwa");
    expect(bannerContent).toContain("Installer la mise à jour");

    const layoutPath = path.resolve(process.cwd(), "src/app/(dashboard)/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");
    expect(layoutContent).toContain("UpdateNotificationBanner");
  });

  test("4. Le manifest PWA intègre le nom, les icônes, le raccourci Investissements et les configurations PWA", () => {
    const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    expect(manifestJson.name).toContain("MonBudget");
    expect(manifestJson.short_name).toBe("MonBudget");
    expect(manifestJson.display).toBe("standalone");
    expect(manifestJson.icons.length).toBeGreaterThanOrEqual(3);

    const shortcuts = manifestJson.shortcuts || [];
    const hasInvestmentsShortcut = shortcuts.some((s: { url: string }) => s.url === "/investments");
    expect(hasInvestmentsShortcut).toBe(true);
  });
});
