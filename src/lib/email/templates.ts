/**
 * Templates HTML professionnels et réactifs pour les emails transactionnels de MonBudget
 */
import { escapeHtml, sanitizeHttpUrl } from "@/lib/utils/security";
import { getPlanCatalog } from "@/lib/moneriz-plans";

interface BaseTemplateOptions {
  appName?: string;
  supportUrl?: string;
}

export function getEmailWrapper(content: string, options: BaseTemplateOptions = {}): string {
  const currentYear = new Date().getFullYear();
  const supportUrl = escapeHtml(
    sanitizeHttpUrl(options.supportUrl, "https://monbudgetpro.com/support")
  );

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MonBudget</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #071324; color: #E2E8F0; margin: 0; padding: 20px 0; }
    .container { max-width: 580px; margin: 0 auto; background: #0A192F; border-radius: 20px; border: 1px solid #1E293B; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .header { padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1E293B; background: linear-gradient(180deg, #0E223D 0%, #0A192F 100%); }
    .logo { font-size: 24px; font-weight: 800; color: #FFFFFF; text-decoration: none; letter-spacing: -0.5px; }
    .logo-accent { color: #38BDF8; }
    .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #CBD5E1; }
    .title { color: #FFFFFF; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px; }
    .button-container { text-align: center; margin: 28px 0; }
    .button { display: inline-block; background-color: #0284C7; color: #FFFFFF !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3); }
    .card { background-color: #0F233D; border-radius: 14px; border: 1px solid #1E3A5F; padding: 20px; margin: 20px 0; }
    .footer { padding: 24px 32px; background-color: #050D19; border-top: 1px solid #1E293B; text-align: center; font-size: 12px; color: #64748B; }
    .footer a { color: #38BDF8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://monbudgetpro.com" class="logo">
        Mon<span class="logo-accent">Budget</span>
      </a>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px;">&copy; ${currentYear} MonBudget. Tous droits réservés.</p>
      <p style="margin: 0;">Besoin d'aide ? <a href="${supportUrl}">Contactez notre support WhatsApp</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function formatXof(amount: number): string {
  return new Intl.NumberFormat("fr-FR")
    .format(Math.round(amount))
    .replace(/[\u00a0\u202f]/g, " ");
}

function getPlanRecapHtml(): string {
  const catalog = getPlanCatalog();
  const personalPrice = formatXof(catalog.personal.monthlyPriceXof);
  const businessPrice = formatXof(catalog.business.monthlyPriceXof);

  return `
    <div class="card">
      <strong style="color: #38BDF8; display: block; margin-bottom: 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
        Vos 3 options après les 30 jours d'essai :
      </strong>
      <ul style="margin: 0; padding-left: 18px; color: #CBD5E1; font-size: 14px; line-height: 1.7;">
        <li><strong>Gratuit (0 FCFA)</strong> : Entrées &amp; Dépenses du quotidien (les modules Budget, Épargne, Dettes, Rapports, Reçus et IA passent en mode cadenassé 🔒).</li>
        <li><strong>Particulier (${personalPrice} FCFA / mois)</strong> : débloque <strong>100 % des fonctionnalités actuelles</strong> (Budget, Reste à vivre, Épargne, Dettes, Exports PDF/CSV, Reçus et Conseiller IA).</li>
        <li><strong>Entreprise &amp; Pro (${businessPrice} FCFA / mois)</strong> : tout du plan Particulier + support prioritaire 7j/7 et futurs modules dédiés Entreprise.</li>
      </ul>
    </div>
  `;
}

/**
 * 1. Email de bienvenue personnalisé avec essai gratuit complet de 30 jours
 */
export function getWelcomeEmailHtml(params: {
  name?: string;
  dashboardUrl?: string;
  trialDays?: number;
  trialEndsAtFormatted?: string | null;
}): string {
  const userName = escapeHtml(params.name ? params.name : "cher membre");
  const dashboardUrl = escapeHtml(
    sanitizeHttpUrl(params.dashboardUrl, "https://monbudget.app/dashboard")
  );
  const trialDays = Math.max(1, Math.round(params.trialDays ?? 30));
  const safeEndDate = params.trialEndsAtFormatted ? escapeHtml(params.trialEndsAtFormatted) : null;

  const content = `
    <h1 class="title">Bienvenue sur MonBudget, ${userName} ! 🎉</h1>
    <p>Nous sommes ravis de vous compter parmi nous pour reprendre en main vos finances et construire votre liberté financière.</p>
    <p>
      Votre <strong>essai gratuit complet de ${trialDays} jours</strong> est activé dès maintenant${safeEndDate ? ` (jusqu'au <strong>${safeEndDate}</strong>)` : ""} : vous profitez de <strong>toutes les fonctionnalités</strong> sans aucune limitation et sans carte bancaire.
    </p>
    
    <div class="card">
      <strong style="color: #38BDF8; display: block; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
        💡 3 conseils rapides pour bien démarrer :
      </strong>
      <ol style="margin: 0; padding-left: 20px; color: #CBD5E1; font-size: 14px; line-height: 1.7;">
        <li><strong>Définissez votre jour de paie</strong> dans vos Réglages (ex: le 28 du mois).</li>
        <li><strong>Créez vos enveloppes de dépenses</strong> pour ventiler vos besoins essentiels.</li>
        <li><strong>Installez l'application sur votre smartphone</strong> pour saisir vos dépenses en 2 clics.</li>
      </ol>
    </div>

    ${getPlanRecapHtml()}

    <div class="button-container">
      <a href="${dashboardUrl}" class="button">Accéder à mon tableau de bord &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #94A3B8; margin-top: 24px;">
      Une question ? Notre équipe d'assistance est joignable 7j/7 directement sur WhatsApp au <strong>+228 98 37 61 01</strong>.
    </p>
  `;

  return getEmailWrapper(content);
}

/**
 * 2. Email de relance J-3 avant la fin des 30 jours d'essai gratuit
 */
export function getTrialReminderEmailHtml(params: {
  name?: string;
  daysRemaining: number;
  trialEndsAtFormatted?: string | null;
  subscriptionUrl?: string;
}): string {
  const userName = escapeHtml(params.name ? params.name : "Bonjour");
  const daysRemaining = Math.max(1, Math.round(params.daysRemaining));
  const safeEndDate = params.trialEndsAtFormatted ? escapeHtml(params.trialEndsAtFormatted) : null;
  const subscriptionUrl = escapeHtml(
    sanitizeHttpUrl(params.subscriptionUrl, "https://monbudgetpro.com/settings?tab=subscription")
  );

  const content = `
    <h1 class="title" style="color: #F59E0B;">⏳ Plus que ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""} d'essai gratuit complet</h1>
    <p>${userName}, votre période découverte de 30 jours avec toutes les fonctionnalités MonBudget arrive bientôt à son terme${safeEndDate ? ` le <strong>${safeEndDate}</strong>` : ""}.</p>
    <p>Préparez dès maintenant la suite en choisissant la formule adaptée à vos besoins :</p>

    ${getPlanRecapHtml()}

    <div class="button-container">
      <a href="${subscriptionUrl}" class="button">Choisir mon abonnement dès maintenant &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #94A3B8;">
      Vos transactions, enveloppes et objectifs restent enregistrés en sécurité à 100 % quel que soit votre choix.
    </p>
  `;

  return getEmailWrapper(content);
}

/**
 * 3. Email de notification J0 : Fin des 30 jours d'essai gratuit — Choix requis
 */
export function getTrialExpiredEmailHtml(params: {
  name?: string;
  subscriptionUrl?: string;
}): string {
  const userName = escapeHtml(params.name ? params.name : "Bonjour");
  const subscriptionUrl = escapeHtml(
    sanitizeHttpUrl(params.subscriptionUrl, "https://monbudgetpro.com/settings?tab=subscription")
  );

  const personalPrice = formatXof(getPlanCatalog().personal.monthlyPriceXof);

  const content = `
    <h1 class="title" style="color: #38BDF8;">🔒 Vos 30 jours d'essai complet sont terminés</h1>
    <p>${userName}, merci d'avoir testé MonBudget pendant 30 jours ! Vos données restent intactes dans votre compte.</p>
    <p>
      Votre compte est désormais passé en <strong>mode Gratuit limité</strong> (Entrées &amp; Dépenses illimitées). Les modules Budget, Épargne, Dettes, Rapports PDF/CSV, Reçus et Conseiller IA sont cadenassés jusqu'au choix d'une formule payante.
    </p>

    ${getPlanRecapHtml()}

    <div class="button-container">
      <a href="${subscriptionUrl}" class="button">Activer Particulier (${personalPrice} FCFA) ou Entreprise &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #94A3B8;">
      Paiement instantané par Mobile Money (Wave, Orange, MTN, Moov) ou Carte Bancaire.
    </p>
  `;

  return getEmailWrapper(content);
}

/**
 * 4. Email post-paiement avec succès : Confirmation d'abonnement & lancement du décompte
 */
export function getPaymentSuccessEmailHtml(params: {
  name?: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  amountXof: number;
  reference: string;
  expiresAtFormatted?: string | null;
  dashboardUrl?: string;
}): string {
  const userName = escapeHtml(params.name ? params.name : "Bonjour");
  const safePlanName = escapeHtml(params.planName);
  const safeReference = escapeHtml(params.reference);
  const safeExpiry = params.expiresAtFormatted ? escapeHtml(params.expiresAtFormatted) : null;
  const cycleLabel = params.billingCycle === "yearly" ? "Annuelle (12 mois)" : "Mensuelle (1 mois)";
  const dashboardUrl = escapeHtml(
    sanitizeHttpUrl(params.dashboardUrl, "https://monbudgetpro.com/dashboard")
  );

  const content = `
    <h1 class="title" style="color: #10B981;">✅ Abonnement ${safePlanName} activé avec succès !</h1>
    <p>${userName}, votre paiement a bien été confirmé. Toutes les fonctionnalités de votre formule sont immédiatement débloquées et le décompte de votre période est lancé.</p>

    <div class="card" style="border-left: 4px solid #10B981;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #CBD5E1;">
        <tr style="border-bottom: 1px solid #1E293B;">
          <td style="padding: 8px 0;">Formule activée</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #FFFFFF;">${safePlanName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1E293B;">
          <td style="padding: 8px 0;">Périodicité</td>
          <td style="padding: 8px 0; text-align: right; color: #FFFFFF;">${cycleLabel}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1E293B;">
          <td style="padding: 8px 0;">Montant payé</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10B981;">${formatXof(params.amountXof)} FCFA</td>
        </tr>
        <tr style="border-bottom: 1px solid #1E293B;">
          <td style="padding: 8px 0;">Référence</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #94A3B8;">${safeReference}</td>
        </tr>
        ${
          safeExpiry
            ? `<tr>
                <td style="padding: 8px 0 0;">Prochaine échéance</td>
                <td style="padding: 8px 0 0; text-align: right; font-weight: bold; color: #38BDF8;">${safeExpiry}</td>
              </tr>`
            : ""
        }
      </table>
    </div>

    <div class="button-container">
      <a href="${dashboardUrl}" class="button">Accéder à mon tableau de bord &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #94A3B8;">
      Merci pour votre confiance ! Assistance WhatsApp 7j/7 au <strong>+228 98 37 61 01</strong>.
    </p>
  `;

  return getEmailWrapper(content);
}

/**
 * 5. Email de relance renouvellement J-3 avant échéance d'un abonnement payant
 */
export function getRenewalReminderEmailHtml(params: {
  name?: string;
  planName: string;
  daysRemaining: number;
  expiresAtFormatted?: string | null;
  subscriptionUrl?: string;
}): string {
  const userName = escapeHtml(params.name ? params.name : "Bonjour");
  const safePlanName = escapeHtml(params.planName);
  const daysRemaining = Math.max(1, Math.round(params.daysRemaining));
  const safeExpiry = params.expiresAtFormatted ? escapeHtml(params.expiresAtFormatted) : null;
  const subscriptionUrl = escapeHtml(
    sanitizeHttpUrl(params.subscriptionUrl, "https://monbudgetpro.com/settings?tab=subscription")
  );

  const content = `
    <h1 class="title" style="color: #F59E0B;">🔔 Renouvellement MonBudget dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}</h1>
    <p>${userName}, votre abonnement <strong>${safePlanName}</strong> arrive à échéance${safeExpiry ? ` le <strong>${safeExpiry}</strong>` : ""}.</p>
    <p>
      Renouvelez dès maintenant pour conserver sans interruption vos enveloppes budgétaires, objectifs d'épargne, dettes &amp; créances, exports PDF/CSV et votre Conseiller IA.
    </p>

    <div class="button-container">
      <a href="${subscriptionUrl}" class="button">Renouveler mon abonnement &rarr;</a>
    </div>
  `;

  return getEmailWrapper(content);
}

/**
 * 6. Email d'expiration d'abonnement payant -> bascule en mode Gratuit cadenassé
 */
export function getSubscriptionExpiredEmailHtml(params: {
  name?: string;
  previousPlanName: string;
  subscriptionUrl?: string;
}): string {
  const userName = escapeHtml(params.name ? params.name : "Bonjour");
  const safePlanName = escapeHtml(params.previousPlanName);
  const subscriptionUrl = escapeHtml(
    sanitizeHttpUrl(params.subscriptionUrl, "https://monbudgetpro.com/settings?tab=subscription")
  );

  const personalPrice = formatXof(getPlanCatalog().personal.monthlyPriceXof);

  const content = `
    <h1 class="title" style="color: #EF4444;">🔒 Abonnement ${safePlanName} expiré</h1>
    <p>${userName}, votre abonnement <strong>${safePlanName}</strong> est arrivé à échéance.</p>
    <p>
      Vos données sont conservées intactes, et votre compte est passé en <strong>mode Gratuit</strong> (Entrées &amp; Dépenses). Les outils avancés sont temporairement cadenassés jusqu'au renouvellement de votre formule (dès <strong>${personalPrice} FCFA / mois</strong>).
    </p>

    <div class="button-container">
      <a href="${subscriptionUrl}" class="button">Réactiver mon abonnement (${personalPrice} FCFA) &rarr;</a>
    </div>
  `;

  return getEmailWrapper(content);
}

/**
 * 7. Email d'alerte de budget (Seuil 80% ou dépassement 100%)
 */
export function getBudgetAlertEmailHtml(params: {
  name?: string;
  categoryName: string;
  spent: number;
  allocated: number;
  percent: number;
  currency?: string;
  dashboardUrl?: string;
}): string {
  const userName = escapeHtml(params.name ? params.name : "Bonjour");
  const safeCategoryName = escapeHtml(params.categoryName);
  const currency = escapeHtml(params.currency || "FCFA");
  const isOver = params.percent >= 100;
  const alertColor = isOver ? "#EF4444" : "#F59E0B";
  const alertTitle = isOver ? "🚨 Alerte Dépassement de Budget" : "⚠️ Vigilance : Seuil de 80% atteint";
  const dashboardUrl = escapeHtml(
    sanitizeHttpUrl(params.dashboardUrl, "https://monbudget.app/dashboard")
  );
  const safePercent = Math.max(0, Math.round(Number(params.percent) || 0));

  const formattedSpent = new Intl.NumberFormat("fr-FR").format(params.spent);
  const formattedAllocated = new Intl.NumberFormat("fr-FR").format(params.allocated);

  const content = `
    <h1 class="title" style="color: ${alertColor};">${alertTitle}</h1>
    <p>${userName}, une de vos enveloppes budgétaires requiert votre attention pour ce mois :</p>
    
    <div class="card" style="border-left: 4px solid ${alertColor};">
      <div style="font-size: 18px; font-weight: bold; color: #FFFFFF; margin-bottom: 8px;">
        ${safeCategoryName}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; color: #CBD5E1; margin-bottom: 12px;">
        <span>Dépensé : <strong>${formattedSpent} ${currency}</strong></span>
        <span>Alloué : <strong>${formattedAllocated} ${currency}</strong></span>
      </div>
      <div style="background-color: #0A192F; height: 10px; border-radius: 5px; overflow: hidden; border: 1px solid #1E293B;">
        <div style="background-color: ${alertColor}; width: ${Math.min(safePercent, 100)}%; height: 100%;"></div>
      </div>
      <div style="margin-top: 8px; font-size: 12px; color: ${alertColor}; font-weight: 600;">
        ${safePercent}% du budget consommé
      </div>
    </div>

    <p style="font-size: 14px;">
      ${
        isOver
          ? "Vous avez dépassé le montant prévu pour ce poste. Pensez à ajuster vos dépenses sur d'autres enveloppes pour maintenir l'équilibre de votre solde disponible."
          : "Vous approchez du plafond prévu pour cette catégorie. Ralentissez vos dépenses sur ce poste d'ici votre prochaine paie."
      }
    </p>

    <div class="button-container">
      <a href="${dashboardUrl}" class="button">Voir mes enveloppes budgétaires &rarr;</a>
    </div>
  `;

  return getEmailWrapper(content);
}

/**
 * 8. Email récapitulatif mensuel / hebdomadaire
 */
export function getMonthlyReportEmailHtml(params: {
  name?: string;
  monthName: string;
  income: number;
  totalExpenses: number;
  savings: number;
  remaining: number;
  currency?: string;
  dashboardUrl?: string;
}): string {
  const safeMonthName = escapeHtml(params.monthName);
  const currency = escapeHtml(params.currency || "FCFA");
  const dashboardUrl = escapeHtml(
    sanitizeHttpUrl(params.dashboardUrl, "https://monbudget.app/dashboard")
  );
  const format = (v: number) => new Intl.NumberFormat("fr-FR").format(v);

  const content = `
    <h1 class="title">Bilan Financier — ${safeMonthName} 📊</h1>
    <p>Voici la synthèse consolidée de votre gestion budgétaire pour le mois écoulé :</p>
    
    <div class="card">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #CBD5E1;">
        <tr style="border-bottom: 1px solid #1E293B;">
          <td style="padding: 10px 0;">Revenus perçus</td>
          <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #10B981;">+${format(params.income)} ${currency}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1E293B;">
          <td style="padding: 10px 0;">Dépenses réelles (avec épargne)</td>
          <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #EF4444;">-${format(params.totalExpenses)} ${currency}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1E293B;">
          <td style="padding: 10px 0;">Épargne sécurisée</td>
          <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #38BDF8;">${format(params.savings)} ${currency}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0 0; font-weight: bold; color: #FFFFFF;">Solde net restant</td>
          <td style="padding: 12px 0 0; text-align: right; font-weight: bold; font-size: 16px; color: ${params.remaining >= 0 ? "#38BDF8" : "#EF4444"};">
            ${params.remaining >= 0 ? "+" : ""}${format(params.remaining)} ${currency}
          </td>
        </tr>
      </table>
    </div>

    <div class="button-container">
      <a href="${dashboardUrl}" class="button">Consulter mes rapports complets &rarr;</a>
    </div>
  `;

  return getEmailWrapper(content);
}
