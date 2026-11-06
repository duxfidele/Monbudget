import { test, expect } from "@playwright/test";
import {
  getWelcomeEmailHtml,
  getBudgetAlertEmailHtml,
  getMonthlyReportEmailHtml,
} from "../src/lib/email/templates";
import {
  sendEmail,
  sendWelcomeEmail,
  sendBudgetAlertEmail,
  sendMonthlyReportEmail,
} from "../src/lib/email/service";

test.describe("Email Infrastructure & Templates — SaaS Communications", () => {
  test.beforeEach(() => {
    // S'assurer qu'aucune clé fictive n'est active pour les tests unitaires locaux
    delete process.env.RESEND_API_KEY;
  });

  test("generates welcome email with personalized name and quick start guide", () => {
    const html = getWelcomeEmailHtml({ name: "Frère Fidèle" });

    expect(html).toContain("Bienvenue sur MonBudget, Frère Fidèle !");
    expect(html).toContain("Définissez votre jour de paie");
    expect(html).toContain("Créez vos enveloppes de dépenses");
    expect(html).toContain("Installez l'application sur votre smartphone");
    expect(html).toContain("+228 98 37 61 01");
  });

  test("generates budget alert email with accurate warning colors and percentages", () => {
    // Cas A : Seuil 80%
    const html80 = getBudgetAlertEmailHtml({
      name: "Fidèle",
      categoryName: "Alimentation",
      spent: 80000,
      allocated: 100000,
      percent: 80,
      currency: "FCFA",
    });

    const clean80 = html80.replace(/\u202F/g, " ");
    expect(clean80).toContain("Vigilance : Seuil de 80% atteint");
    expect(clean80).toContain("Alimentation");
    expect(clean80).toContain("80 000 FCFA");
    expect(clean80).toContain("100 000 FCFA");

    // Cas B : Dépassement 100%
    const html100 = getBudgetAlertEmailHtml({
      name: "Fidèle",
      categoryName: "Loisirs",
      spent: 60000,
      allocated: 50000,
      percent: 120,
      currency: "FCFA",
    });

    expect(html100).toContain("Alerte Dépassement de Budget");
    expect(html100).toContain("Loisirs");
    expect(html100).toContain("#EF4444"); // Rouge d'alerte
  });

  test("generates monthly report email consolidating income, expenses and savings", () => {
    const html = getMonthlyReportEmailHtml({
      name: "Fidèle",
      monthName: "Octobre 2026",
      income: 500000,
      totalExpenses: 350000,
      savings: 100000,
      remaining: 150000,
      currency: "FCFA",
    });

    const cleanHtml = html.replace(/\u202F/g, " ");
    expect(cleanHtml).toContain("Bilan Financier — Octobre 2026");
    expect(cleanHtml).toContain("+500 000 FCFA");
    expect(cleanHtml).toContain("-350 000 FCFA");
    expect(cleanHtml).toContain("100 000 FCFA");
    expect(cleanHtml).toContain("+150 000 FCFA");
  });

  test("email service gracefully degrades in development/test when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendEmail({
      to: "test@monbudget.app",
      subject: "Test email",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(true);
    expect(result.mocked).toBe(true);
    expect(result.messageId).toContain("mock_email_");
  });

  test("helper functions sendWelcomeEmail and sendBudgetAlertEmail invoke service without error", async () => {
    delete process.env.RESEND_API_KEY;

    const welcomeRes = await sendWelcomeEmail("fidele@monbudget.app", "Fidèle");
    expect(welcomeRes.success).toBe(true);

    const alertRes = await sendBudgetAlertEmail("fidele@monbudget.app", {
      categoryName: "Carburant",
      spent: 42000,
      allocated: 50000,
      percent: 84,
      currency: "FCFA",
    });
    expect(alertRes.success).toBe(true);

    const reportRes = await sendMonthlyReportEmail("fidele@monbudget.app", {
      monthName: "Novembre 2026",
      income: 600000,
      totalExpenses: 400000,
      savings: 150000,
      remaining: 200000,
      currency: "FCFA",
    });
    expect(reportRes.success).toBe(true);
  });
});
