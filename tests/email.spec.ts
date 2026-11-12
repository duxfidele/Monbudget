import { test, expect } from "@playwright/test";
import {
  getWelcomeEmailHtml,
  getTrialReminderEmailHtml,
  getTrialExpiredEmailHtml,
  getPaymentSuccessEmailHtml,
  getRenewalReminderEmailHtml,
  getSubscriptionExpiredEmailHtml,
  getBudgetAlertEmailHtml,
  getMonthlyReportEmailHtml,
} from "../src/lib/email/templates";
import {
  sendEmail,
  sendWelcomeEmail,
  sendTrialReminderEmail,
  sendTrialExpiredEmail,
  sendPaymentSuccessEmail,
  sendRenewalReminderEmail,
  sendSubscriptionExpiredEmail,
  sendBudgetAlertEmail,
  sendMonthlyReportEmail,
} from "../src/lib/email/service";

test.describe("Email Infrastructure & Templates — SaaS Communications", () => {
  test.beforeEach(() => {
    // S'assurer qu'aucune clé fictive n'est active pour les tests unitaires locaux
    delete process.env.RESEND_API_KEY;
  });

  test("generates welcome email with personalized name, 30-day full trial and quick start guide", () => {
    const html = getWelcomeEmailHtml({
      name: "Frère Fidèle",
      trialDays: 30,
      trialEndsAtFormatted: "12/12/2026",
    });

    expect(html).toContain("Bienvenue sur MonBudget, Frère Fidèle !");
    expect(html).toContain("essai gratuit complet de 30 jours");
    expect(html).toContain("12/12/2026");
    expect(html).toContain("Particulier (500 FCFA / mois)");
    expect(html).toContain("Entreprise &amp; Pro (1 500 FCFA / mois)");
    expect(html).toContain("Définissez votre jour de paie");
    expect(html).toContain("Créez vos enveloppes de dépenses");
    expect(html).toContain("Installez l'application sur votre smartphone");
    expect(html).toContain("+228 98 37 61 01");
  });

  test("generates trial J-3 reminder, trial expired J0, post-payment success, renewal reminder and expired emails", () => {
    const trialJ3 = getTrialReminderEmailHtml({
      name: "Koffi",
      daysRemaining: 3,
      trialEndsAtFormatted: "10/12/2026",
    });
    expect(trialJ3).toContain("Plus que 3 jours d'essai gratuit complet");
    expect(trialJ3).toContain("10/12/2026");
    expect(trialJ3).toContain("500 FCFA / mois");

    const trialExp = getTrialExpiredEmailHtml({ name: "Koffi" });
    expect(trialExp).toContain("Vos 30 jours d'essai complet sont terminés");
    expect(trialExp).toContain("mode Gratuit limité");

    const paymentSuccess = getPaymentSuccessEmailHtml({
      name: "Koffi",
      planName: "Particulier",
      billingCycle: "monthly",
      amountXof: 500,
      reference: "MB-LIVE-PER-001",
      expiresAtFormatted: "12/01/2027",
    }).replace(/\u202F/g, " ");
    expect(paymentSuccess).toContain("Abonnement Particulier activé avec succès");
    expect(paymentSuccess).toContain("500 FCFA");
    expect(paymentSuccess).toContain("MB-LIVE-PER-001");
    expect(paymentSuccess).toContain("12/01/2027");

    const renewalJ3 = getRenewalReminderEmailHtml({
      name: "Koffi",
      planName: "Entreprise & Pro",
      daysRemaining: 3,
      expiresAtFormatted: "12/01/2027",
    });
    expect(renewalJ3).toContain("Renouvellement MonBudget dans 3 jours");
    expect(renewalJ3).toContain("Entreprise &amp; Pro");
    expect(renewalJ3).toContain("12/01/2027");

    const expiredPaid = getSubscriptionExpiredEmailHtml({
      name: "Koffi",
      previousPlanName: "Particulier",
    });
    expect(expiredPaid).toContain("Abonnement Particulier expiré");
    expect(expiredPaid).toContain("500 FCFA / mois");
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

    const lifecycleResults = await Promise.all([
      sendTrialReminderEmail("koffi@monbudget.app", { name: "Koffi", daysRemaining: 3 }),
      sendTrialExpiredEmail("koffi@monbudget.app", { name: "Koffi" }),
      sendPaymentSuccessEmail("koffi@monbudget.app", {
        name: "Koffi",
        planName: "Particulier",
        billingCycle: "monthly",
        amountXof: 500,
        reference: "MB-TEST-1",
      }),
      sendRenewalReminderEmail("koffi@monbudget.app", {
        name: "Koffi",
        planName: "Particulier",
        daysRemaining: 3,
      }),
      sendSubscriptionExpiredEmail("koffi@monbudget.app", {
        name: "Koffi",
        previousPlanName: "Particulier",
      }),
    ]);
    for (const r of lifecycleResults) {
      expect(r.success).toBe(true);
      expect(r.mocked).toBe(true);
    }
  });

  test("neutralizes XSS and javascript: URLs in email templates", () => {
    const xssPayload = `<script>alert("xss")</script>`;
    const welcome = getWelcomeEmailHtml({
      name: xssPayload,
      dashboardUrl: "javascript:alert(1)",
    });
    expect(welcome).not.toContain("<script>alert");
    expect(welcome).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(welcome).not.toContain('href="javascript:');
    expect(welcome).toContain('href="https://monbudget.app/dashboard"');

    const alert = getBudgetAlertEmailHtml({
      name: `<img src=x onerror=alert(1)>`,
      categoryName: `<svg onload=alert(2)>`,
      spent: 90000,
      allocated: 100000,
      percent: 90,
      currency: `<b>FCFA</b>`,
      dashboardUrl: "javascript:evil()",
    });
    expect(alert).not.toContain("<img src=x");
    expect(alert).not.toContain("<svg onload");
    expect(alert).not.toContain("<b>FCFA</b>");
    expect(alert).not.toContain("javascript:evil()");

    const monthly = getMonthlyReportEmailHtml({
      monthName: `<script>steal()</script>`,
      income: 100000,
      totalExpenses: 50000,
      savings: 10000,
      remaining: 50000,
      currency: `"><script>x()</script>`,
      dashboardUrl: "data:text/html,xss",
    });
    expect(monthly).not.toContain("<script>steal");
    expect(monthly).not.toContain("<script>x()</script>");
    expect(monthly).toContain('href="https://monbudget.app/dashboard"');

    const lifecycleXss = [
      getTrialReminderEmailHtml({
        name: xssPayload,
        daysRemaining: 3,
        trialEndsAtFormatted: xssPayload,
        subscriptionUrl: "javascript:evil()",
      }),
      getTrialExpiredEmailHtml({
        name: xssPayload,
        subscriptionUrl: "data:text/html,xss",
      }),
      getPaymentSuccessEmailHtml({
        name: xssPayload,
        planName: xssPayload,
        billingCycle: "monthly",
        amountXof: 500,
        reference: xssPayload,
        expiresAtFormatted: xssPayload,
        dashboardUrl: "javascript:alert(1)",
      }),
      getRenewalReminderEmailHtml({
        name: xssPayload,
        planName: xssPayload,
        daysRemaining: 3,
        subscriptionUrl: "javascript:alert(1)",
      }),
      getSubscriptionExpiredEmailHtml({
        name: xssPayload,
        previousPlanName: xssPayload,
        subscriptionUrl: "javascript:alert(1)",
      }),
    ];
    for (const html of lifecycleXss) {
      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).not.toContain('href="javascript:');
      expect(html).not.toContain('href="data:');
    }
  });
});
