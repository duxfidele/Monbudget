/**
 * Service d'envoi d'emails transactionnels pour MonBudget
 * Architecture résiliente : Envoi via Resend avec fallback local gracieux (zéro plantage en dev).
 */

import {
  getWelcomeEmailHtml,
  getTrialReminderEmailHtml,
  getTrialExpiredEmailHtml,
  getPaymentSuccessEmailHtml,
  getRenewalReminderEmailHtml,
  getSubscriptionExpiredEmailHtml,
  getBudgetAlertEmailHtml,
  getMonthlyReportEmailHtml,
} from "./templates";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  mocked?: boolean;
}

function getDefaultFrom(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || "MonBudget <notifications@monbudgetpro.com>";
}

function getDefaultReplyTo(): string {
  return process.env.RESEND_REPLY_TO?.trim() || "support@monbudgetpro.com";
}

function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return "https://monbudgetpro.com";
  return raw.replace(/\/+$/, "");
}

/**
 * Envoie un email via l'API Resend de manière sécurisée et résiliente
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo = getDefaultReplyTo(),
  from = getDefaultFrom(),
}: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipientList = Array.isArray(to) ? to : [to];

  // Mode Fallback Gracieux : Si aucune clé Resend n'est configurée,
  // on journalise sans faire planter l'application (les notifications in-app restent actives).
  if (!apiKey) {
    if (process.env.NODE_ENV !== "test") {
      console.log(`📨 [Email Service — Simulation Resend]`);
      console.log(`   Destinataire(s) : ${recipientList.join(", ")}`);
      console.log(`   Sujet           : ${subject}`);
    }
    return {
      success: true,
      messageId: `mock_email_${Date.now()}`,
      mocked: true,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: recipientList,
        subject,
        html,
        reply_to: replyTo,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Erreur retournée par l'API Resend :", data);
      return {
        success: false,
        error: data?.message || "Échec de l'envoi d'email via Resend.",
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err: any) {
    console.error("❌ Exception réseau lors de l'envoi de l'email :", err);
    return {
      success: false,
      error: err?.message || "Erreur réseau inconnue lors de l'envoi de l'email.",
    };
  }
}

/**
 * 1. Email de bienvenue + essai gratuit 30 jours complet
 */
export async function sendWelcomeEmail(
  to: string,
  name?: string,
  options?: { trialDays?: number; trialEndsAtFormatted?: string | null }
): Promise<SendEmailResult> {
  const html = getWelcomeEmailHtml({
    name,
    dashboardUrl: `${getAppBaseUrl()}/dashboard`,
    trialDays: options?.trialDays ?? 30,
    trialEndsAtFormatted: options?.trialEndsAtFormatted,
  });
  return await sendEmail({
    to,
    subject: `Bienvenue sur MonBudget${name ? `, ${name}` : ""} ! 🎉 Votre essai complet de 30 jours est actif`,
    html,
  });
}

/**
 * 2. Email de relance J-3 avant la fin des 30 jours d'essai gratuit
 */
export async function sendTrialReminderEmail(
  to: string,
  params: {
    name?: string;
    daysRemaining: number;
    trialEndsAtFormatted?: string | null;
  }
): Promise<SendEmailResult> {
  const html = getTrialReminderEmailHtml({
    ...params,
    subscriptionUrl: `${getAppBaseUrl()}/settings?tab=subscription`,
  });
  const d = Math.max(1, Math.round(params.daysRemaining));
  return await sendEmail({
    to,
    subject: `⏳ Plus que ${d} jour${d > 1 ? "s" : ""} d'essai gratuit complet — Choisissez votre formule MonBudget`,
    html,
  });
}

/**
 * 3. Email J0 : Fin des 30 jours d'essai — Choix du plan requis
 */
export async function sendTrialExpiredEmail(
  to: string,
  params?: { name?: string }
): Promise<SendEmailResult> {
  const html = getTrialExpiredEmailHtml({
    name: params?.name,
    subscriptionUrl: `${getAppBaseUrl()}/settings?tab=subscription`,
  });
  return await sendEmail({
    to,
    subject: `🔒 Votre essai gratuit de 30 jours est terminé — Choisissez votre formule MonBudget`,
    html,
  });
}

/**
 * 4. Email post-paiement avec succès : Confirmation + lancement du décompte
 */
export async function sendPaymentSuccessEmail(
  to: string,
  params: {
    name?: string;
    planName: string;
    billingCycle: "monthly" | "yearly";
    amountXof: number;
    reference: string;
    expiresAtFormatted?: string | null;
  }
): Promise<SendEmailResult> {
  const html = getPaymentSuccessEmailHtml({
    ...params,
    dashboardUrl: `${getAppBaseUrl()}/dashboard`,
  });
  return await sendEmail({
    to,
    subject: `✅ Abonnement ${params.planName} activé avec succès — MonBudget`,
    html,
  });
}

/**
 * 5. Email de relance J-3 avant échéance d'abonnement payant
 */
export async function sendRenewalReminderEmail(
  to: string,
  params: {
    name?: string;
    planName: string;
    daysRemaining: number;
    expiresAtFormatted?: string | null;
  }
): Promise<SendEmailResult> {
  const html = getRenewalReminderEmailHtml({
    ...params,
    subscriptionUrl: `${getAppBaseUrl()}/settings?tab=subscription`,
  });
  const d = Math.max(1, Math.round(params.daysRemaining));
  return await sendEmail({
    to,
    subject: `🔔 Votre abonnement ${params.planName} expire dans ${d} jour${d > 1 ? "s" : ""} — MonBudget`,
    html,
  });
}

/**
 * 6. Email d'expiration d'abonnement payant
 */
export async function sendSubscriptionExpiredEmail(
  to: string,
  params: {
    name?: string;
    previousPlanName: string;
  }
): Promise<SendEmailResult> {
  const html = getSubscriptionExpiredEmailHtml({
    ...params,
    subscriptionUrl: `${getAppBaseUrl()}/settings?tab=subscription`,
  });
  return await sendEmail({
    to,
    subject: `🔒 Votre abonnement ${params.previousPlanName} a expiré — MonBudget`,
    html,
  });
}

/**
 * Raccourci : Envoi d'une alerte de budget (seuil 80% ou 100%)
 */
export async function sendBudgetAlertEmail(
  to: string,
  params: {
    name?: string;
    categoryName: string;
    spent: number;
    allocated: number;
    percent: number;
    currency?: string;
  }
): Promise<SendEmailResult> {
  const isOver = params.percent >= 100;
  const subject = isOver
    ? `🚨 Alerte : Budget dépassé sur "${params.categoryName}" (${params.percent}%)`
    : `⚠️ Vigilance : 80% du budget atteint sur "${params.categoryName}"`;

  const html = getBudgetAlertEmailHtml({
    ...params,
    dashboardUrl: `${getAppBaseUrl()}/dashboard`,
  });
  return await sendEmail({
    to,
    subject,
    html,
  });
}

/**
 * Raccourci : Envoi d'un rapport mensuel de clôture
 */
export async function sendMonthlyReportEmail(
  to: string,
  params: {
    name?: string;
    monthName: string;
    income: number;
    totalExpenses: number;
    savings: number;
    remaining: number;
    currency?: string;
  }
): Promise<SendEmailResult> {
  const html = getMonthlyReportEmailHtml({
    ...params,
    dashboardUrl: `${getAppBaseUrl()}/dashboard`,
  });
  return await sendEmail({
    to,
    subject: `📊 Votre Bilan Financier de ${params.monthName} est disponible — MonBudget`,
    html,
  });
}
