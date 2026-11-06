/**
 * Service d'envoi d'emails transactionnels pour MonBudget
 * Architecture résiliente : Envoi via Resend avec fallback local gracieux (zéro plantage en dev).
 */

import {
  getWelcomeEmailHtml,
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

/**
 * Envoie un email via l'API Resend de manière sécurisée et résiliente
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo = "support@monbudget.app",
  from = "MonBudget <notifications@monbudget.app>",
}: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipientList = Array.isArray(to) ? to : [to];

  // Mode Fallback Gracieux : Si aucune clé Resend n'est configurée (ex: environnement local de dev),
  // on journalise sans faire planter l'application
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
 * Raccourci : Envoi d'un email de bienvenue
 */
export async function sendWelcomeEmail(to: string, name?: string): Promise<SendEmailResult> {
  const html = getWelcomeEmailHtml({ name });
  return await sendEmail({
    to,
    subject: `Bienvenue sur MonBudget${name ? `, ${name}` : ""} ! 🎉 Reprenez le contrôle de votre argent`,
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

  const html = getBudgetAlertEmailHtml(params);
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
  const html = getMonthlyReportEmailHtml(params);
  return await sendEmail({
    to,
    subject: `📊 Votre Bilan Financier de ${params.monthName} est disponible — MonBudget`,
    html,
  });
}

