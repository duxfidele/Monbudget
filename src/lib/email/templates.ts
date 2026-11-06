/**
 * Templates HTML professionnels et réactifs pour les emails transactionnels de MonBudget
 */

interface BaseTemplateOptions {
  appName?: string;
  supportUrl?: string;
}

export function getEmailWrapper(content: string, options: BaseTemplateOptions = {}): string {
  const currentYear = new Date().getFullYear();
  const supportUrl = options.supportUrl || "https://monbudget.app/support";

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
      <a href="https://monbudget.app" class="logo">
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

/**
 * 1. Email de bienvenue personnalisé
 */
export function getWelcomeEmailHtml(params: {
  name?: string;
  dashboardUrl?: string;
}): string {
  const userName = params.name ? params.name : "cher membre";
  const dashboardUrl = params.dashboardUrl || "https://monbudget.app/dashboard";

  const content = `
    <h1 class="title">Bienvenue sur MonBudget, ${userName} ! 🎉</h1>
    <p>Nous sommes ravis de vous compter parmi nous pour reprendre en main vos finances et construire votre liberté financière.</p>
    
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
 * 2. Email d'alerte de budget (Seuil 80% ou dépassement 100%)
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
  const userName = params.name ? params.name : "Bonjour";
  const currency = params.currency || "FCFA";
  const isOver = params.percent >= 100;
  const alertColor = isOver ? "#EF4444" : "#F59E0B";
  const alertTitle = isOver ? "🚨 Alerte Dépassement de Budget" : "⚠️ Vigilance : Seuil de 80% atteint";
  const dashboardUrl = params.dashboardUrl || "https://monbudget.app/dashboard";

  const formattedSpent = new Intl.NumberFormat("fr-FR").format(params.spent);
  const formattedAllocated = new Intl.NumberFormat("fr-FR").format(params.allocated);

  const content = `
    <h1 class="title" style="color: ${alertColor};">${alertTitle}</h1>
    <p>${userName}, une de vos enveloppes budgétaires requiert votre attention pour ce mois :</p>
    
    <div class="card" style="border-left: 4px solid ${alertColor};">
      <div style="font-size: 18px; font-weight: bold; color: #FFFFFF; margin-bottom: 8px;">
        ${params.categoryName}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; color: #CBD5E1; margin-bottom: 12px;">
        <span>Dépensé : <strong>${formattedSpent} ${currency}</strong></span>
        <span>Alloué : <strong>${formattedAllocated} ${currency}</strong></span>
      </div>
      <div style="background-color: #0A192F; height: 10px; border-radius: 5px; overflow: hidden; border: 1px solid #1E293B;">
        <div style="background-color: ${alertColor}; width: ${Math.min(params.percent, 100)}%; height: 100%;"></div>
      </div>
      <div style="margin-top: 8px; font-size: 12px; color: ${alertColor}; font-weight: 600;">
        ${params.percent}% du budget consommé
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
 * 3. Email récapitulatif mensuel / hebdomadaire
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
  const currency = params.currency || "FCFA";
  const dashboardUrl = params.dashboardUrl || "https://monbudget.app/dashboard";
  const format = (v: number) => new Intl.NumberFormat("fr-FR").format(v);

  const content = `
    <h1 class="title">Bilan Financier — ${params.monthName} 📊</h1>
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

