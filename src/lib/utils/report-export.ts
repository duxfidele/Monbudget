import {
  formatMoney,
  getTotalExpenses,
  getRemainingToLive,
  getSpentByCategory,
  getMonthlySavingsContributions,
  getTotalPayableDebts,
  getTotalReceivableDebts,
  generateFinancialAIAnalysis,
  type DebtItem,
} from "@/lib/utils/budget-calc";
import type { Category, Transaction, SavingsGoal, IncomeSourceEntry } from "@/lib/store/ui-store";

export interface ReportExportPayload {
  monthLabel: string;
  year: number;
  month: number;
  currency: string;
  income: number;
  incomeEntries: IncomeSourceEntry[];
  categories: Category[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  debts: DebtItem[];
}

function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Télécharge un rapport financier complet au format CSV compatible Excel francophone (UTF-8 BOM + séparateur point-virgule)
 */
export function exportMonthlyReportCSV(payload: ReportExportPayload): void {
  const {
    monthLabel,
    year,
    month,
    currency,
    income,
    incomeEntries,
    categories,
    transactions,
    savingsGoals,
    debts,
  } = payload;

  const monthlySavings = getMonthlySavingsContributions(savingsGoals, year, month);
  const totalExpenses = getTotalExpenses(transactions, monthlySavings);
  const totalSavingsAccumulated = savingsGoals.reduce((sum, g) => sum + (Number(g.current) || 0), 0);
  const remaining = getRemainingToLive(income, totalExpenses);
  const payableDebts = getTotalPayableDebts(debts);
  const receivableDebts = getTotalReceivableDebts(debts);

  const aiAnalysis = generateFinancialAIAnalysis({
    income,
    incomeSourcesCount: Math.max(1, incomeEntries.length),
    categories,
    transactions,
    savingsGoals,
    debts,
    monthlySavings,
    currency,
  });

  const rows: string[][] = [];

  // En-tête du document
  rows.push([`RAPPORT FINANCIER MENSUEL - MONBUDGET (${monthLabel.toUpperCase()})`]);
  rows.push([`Généré le`, new Date().toLocaleDateString("fr-FR"), `Devise`, currency]);
  rows.push([]);

  // 1. SYNTHÈSE DES 7 INDICATEURS CLÉS
  rows.push(["1. TABLEAU DE BORD FINANCIER (SYNTHÈSE DU MOIS)"]);
  rows.push(["Indicateur", `Montant (${currency})`, "Détail / Statut"]);
  rows.push(["Revenus du mois", String(Math.round(income)), `${incomeEntries.length} source(s) enregistrée(s)`]);
  rows.push([
    "Dépenses du mois",
    String(Math.round(totalExpenses)),
    income > 0 ? `${Math.round((totalExpenses / income) * 100)}% du revenu` : "0%",
  ]);
  rows.push([
    "Solde disponible (Reste à vivre)",
    String(Math.round(remaining)),
    remaining >= 0 ? "Excédent disponible" : "Déficit budgétaire",
  ]);
  rows.push([
    "Épargne versée ce mois",
    String(Math.round(monthlySavings)),
    `Épargne totale cumulée : ${formatMoney(totalSavingsAccumulated, currency)}`,
  ]);
  rows.push(["Dettes à rembourser (Je dois)", String(Math.round(payableDebts)), "Reste total à payer"]);
  rows.push(["Dettes à récupérer (On me doit)", String(Math.round(receivableDebts)), "Créances totales à encaisser"]);
  rows.push([
    "Score de Santé Financière (IA)",
    `${aiAnalysis.healthScore}/100`,
    `${aiAnalysis.healthLabel} - ${aiAnalysis.summary}`,
  ]);
  rows.push([]);

  // 2. SOURCES DE REVENUS
  rows.push(["2. DÉTAIL DES SOURCES DE REVENUS"]);
  rows.push(["Type de source", "Libellé", `Montant (${currency})`, "Date"]);
  if (incomeEntries.length > 0) {
    for (const entry of incomeEntries) {
      rows.push([
        entry.sourceType || "Salaire",
        entry.label || "Revenu",
        String(Math.round(entry.amount)),
        entry.date || "-",
      ]);
    }
  } else {
    rows.push(["Salaire / Revenu global", "Revenu mensuel déclaré", String(Math.round(income)), "-"]);
  }
  rows.push([]);

  // 3. ENVELOPPES BUDGÉTAIRES & DÉPENSES PAR CATÉGORIE
  rows.push(["3. GESTION DES DÉPENSES PAR CATÉGORIE"]);
  rows.push(["Catégorie", `Budget Alloué (${currency})`, `Dépensé (${currency})`, `Reste (${currency})`, "Taux consommé (%)"]);
  for (const cat of categories) {
    const spent = getSpentByCategory(transactions, cat.name);
    const allocated = Number(cat.amount) || 0;
    const catRemaining = allocated - spent;
    const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : spent > 0 ? 100 : 0;
    rows.push([
      cat.name,
      String(Math.round(allocated)),
      String(Math.round(spent)),
      String(Math.round(catRemaining)),
      `${pct}%`,
    ]);
  }
  rows.push([]);

  // 4. OBJECTIFS D'ÉPARGNE
  rows.push(["4. PROGRESSION DES OBJECTIFS D'ÉPARGNE"]);
  rows.push(["Objectif", `Cible (${currency})`, `Épargne constituée (${currency})`, `Reste à épargner (${currency})`, "Progression (%)"]);
  if (savingsGoals.length > 0) {
    for (const goal of savingsGoals) {
      const target = Number(goal.target) || 0;
      const current = Number(goal.current) || 0;
      const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
      rows.push([
        goal.name,
        String(Math.round(target)),
        String(Math.round(current)),
        String(Math.max(0, Math.round(target - current))),
        `${pct}%`,
      ]);
    }
  } else {
    rows.push(["Aucun objectif d'épargne configuré", "0", "0", "0", "0%"]);
  }
  rows.push([]);

  // 5. DETTES & CRÉANCES
  rows.push(["5. ÉTAT DES DETTES & CRÉANCES"]);
  rows.push(["Type", "Personne", `Montant initial (${currency})`, `Reste (${currency})`, "Échéance", "Statut"]);
  if (debts.length > 0) {
    for (const d of debts) {
      rows.push([
        d.type === "payable" ? "Dette à rembourser (Je dois)" : "Créance à récupérer (On me doit)",
        d.personName,
        String(Math.round(d.totalAmount)),
        String(Math.round(d.remainingAmount)),
        d.dueDate || "Non définie",
        d.status === "paid" ? "Soldé" : d.status === "partial" ? "Partiel" : "En attente",
      ]);
    }
  } else {
    rows.push(["Aucune dette ni créance enregistrée", "-", "0", "0", "-", "-"]);
  }
  rows.push([]);

  // 6. JOURNAL DES TRANSACTIONS DU MOIS
  rows.push(["6. JOURNAL DES TRANSACTIONS DU MOIS"]);
  rows.push(["Date", "Type", "Catégorie / Source", "Libellé", `Montant (${currency})`]);
  if (transactions.length > 0) {
    for (const tx of transactions) {
      const isInc = tx.type === "income" || tx.type === "income_adjustment";
      rows.push([
        tx.date || "-",
        isInc ? "Revenu" : "Dépense",
        tx.category || "-",
        tx.label || "-",
        String(Math.round(tx.amount)),
      ]);
    }
  } else {
    rows.push(["Aucune transaction sur cette période", "-", "-", "-", "0"]);
  }
  rows.push([]);

  // 7. RECOMMANDATIONS IA FINANCIÈRE
  rows.push(["7. RECOMMANDATIONS DE L'INTELLIGENCE ARTIFICIELLE FINANCIÈRE"]);
  rows.push(["Priorité", "Domaine", "Titre", "Recommandation détaillée"]);
  for (const rec of aiAnalysis.recommendations) {
    rows.push([
      rec.priority === "high" ? "Haute" : rec.priority === "medium" ? "Moyenne" : "Conseil",
      rec.category,
      rec.title,
      rec.description,
    ]);
  }

  const csvContent = "\uFEFF" + rows.map((r) => r.map(escapeCsvCell).join(";")).join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeMonth = monthLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  link.href = url;
  link.setAttribute("download", `MonBudget_Rapport_${safeMonth}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Génère et lance le téléchargement / impression PDF du rapport financier mensuel complet
 */
export function exportMonthlyReportPDF(payload: ReportExportPayload): void {
  const {
    monthLabel,
    year,
    month,
    currency,
    income,
    incomeEntries,
    categories,
    transactions,
    savingsGoals,
    debts,
  } = payload;

  const monthlySavings = getMonthlySavingsContributions(savingsGoals, year, month);
  const totalExpenses = getTotalExpenses(transactions, monthlySavings);
  const totalSavingsAccumulated = savingsGoals.reduce((sum, g) => sum + (Number(g.current) || 0), 0);
  const remaining = getRemainingToLive(income, totalExpenses);
  const payableDebts = getTotalPayableDebts(debts);
  const receivableDebts = getTotalReceivableDebts(debts);

  const aiAnalysis = generateFinancialAIAnalysis({
    income,
    incomeSourcesCount: Math.max(1, incomeEntries.length),
    categories,
    transactions,
    savingsGoals,
    debts,
    monthlySavings,
    currency,
  });

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Rapport Financier MonBudget - ${monthLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 28px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #1E3A5F;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .brand {
      font-size: 22px;
      font-weight: 800;
      color: #1E3A5F;
    }
    .subtitle {
      font-size: 13px;
      color: #475569;
      margin-top: 2px;
    }
    .meta {
      text-align: right;
      font-size: 11px;
      color: #64748b;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 22px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .kpi-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
    }
    .kpi-value {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 3px;
    }
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #1E3A5F;
      text-transform: uppercase;
      border-left: 4px solid #1E3A5F;
      padding-left: 8px;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #334155;
    }
    .right { text-align: right; }
    .ai-box {
      border: 1px solid #c7d2fe;
      background: #eef2ff;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 20px;
    }
    .ai-rec {
      margin-top: 6px;
      padding-left: 10px;
      border-left: 3px solid #4f46e5;
    }
    @media print {
      body { padding: 10px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px; padding:10px 14px; background:#1E3A5F; color:#fff; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
    <span>📄 <strong>Aperçu du Rapport PDF (${monthLabel})</strong> — Choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.</span>
    <button onclick="window.print()" style="background:#10b981; color:#fff; border:none; padding:6px 14px; border-radius:6px; font-weight:700; cursor:pointer;">Imprimer / Enregistrer en PDF</button>
  </div>

  <div class="header">
    <div>
      <div class="brand">MonBudget — Rapport Financier Mensuel</div>
      <div class="subtitle">Période : <strong>${monthLabel}</strong></div>
    </div>
    <div class="meta">
      <div>Édité le ${new Date().toLocaleDateString("fr-FR")}</div>
      <div>Devise : <strong>${currency}</strong></div>
      <div>Score Santé IA : <strong>${aiAnalysis.healthScore}/100 (${aiAnalysis.healthLabel})</strong></div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">1. Revenus du mois</div>
      <div class="kpi-value" style="color:#059669;">${formatMoney(income, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">2. Dépenses du mois</div>
      <div class="kpi-value" style="color:#dc2626;">${formatMoney(totalExpenses, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">3. Solde disponible</div>
      <div class="kpi-value" style="color:${remaining < 0 ? "#dc2626" : "#1E3A5F"};">${formatMoney(remaining, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">4. Épargne constituée</div>
      <div class="kpi-value" style="color:#0284c7;">${formatMoney(totalSavingsAccumulated, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">5. Dettes à rembourser</div>
      <div class="kpi-value" style="color:#e11d48;">${formatMoney(payableDebts, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">6. Dettes à récupérer</div>
      <div class="kpi-value" style="color:#d97706;">${formatMoney(receivableDebts, currency)}</div>
    </div>
  </div>

  <div class="ai-box">
    <div style="font-weight:800; color:#312e81; margin-bottom:4px;">
      🤖 Diagnostic de l'Intelligence Artificielle Financière (${aiAnalysis.healthScore}/100 — ${aiAnalysis.healthLabel})
    </div>
    <div style="margin-bottom:8px;">${aiAnalysis.summary}</div>
    ${aiAnalysis.recommendations
      .map(
        (rec) => `
      <div class="ai-rec">
        <strong>${rec.title} :</strong> ${rec.description}
      </div>`
      )
      .join("")}
  </div>

  <div class="section">
    <div class="section-title">B. Sources de Revenus (${monthLabel})</div>
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th>Libellé</th>
          <th class="right">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${
          incomeEntries.length > 0
            ? incomeEntries
                .map(
                  (inc) => `
          <tr>
            <td>${inc.sourceType || "Salaire"}</td>
            <td>${inc.label || "Revenu"}</td>
            <td class="right"><strong>${formatMoney(inc.amount, currency)}</strong></td>
          </tr>`
                )
                .join("")
            : `
          <tr>
            <td>Revenu principal</td>
            <td>Revenu mensuel déclaré</td>
            <td class="right"><strong>${formatMoney(income, currency)}</strong></td>
          </tr>`
        }
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">C. Dépenses par Catégorie</div>
    <table>
      <thead>
        <tr>
          <th>Catégorie</th>
          <th class="right">Budget Alloué</th>
          <th class="right">Dépensé</th>
          <th class="right">Reste</th>
          <th class="right">% Consommé</th>
        </tr>
      </thead>
      <tbody>
        ${categories
          .map((cat) => {
            const spent = getSpentByCategory(transactions, cat.name);
            const allocated = Number(cat.amount) || 0;
            const diff = allocated - spent;
            const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : spent > 0 ? 100 : 0;
            return `
          <tr>
            <td>${cat.name}</td>
            <td class="right">${formatMoney(allocated, currency)}</td>
            <td class="right">${formatMoney(spent, currency)}</td>
            <td class="right" style="color:${diff < 0 ? "#dc2626" : "#059669"};">${formatMoney(diff, currency)}</td>
            <td class="right">${pct}%</td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">D. Objectifs d'Épargne</div>
    <table>
      <thead>
        <tr>
          <th>Objectif</th>
          <th class="right">Montant Cible</th>
          <th class="right">Épargne Constituée</th>
          <th class="right">Reste</th>
          <th class="right">Progression</th>
        </tr>
      </thead>
      <tbody>
        ${
          savingsGoals.length > 0
            ? savingsGoals
                .map((g) => {
                  const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                  return `
          <tr>
            <td>${g.name}</td>
            <td class="right">${formatMoney(g.target, currency)}</td>
            <td class="right">${formatMoney(g.current, currency)}</td>
            <td class="right">${formatMoney(Math.max(0, g.target - g.current), currency)}</td>
            <td class="right"><strong>${pct}%</strong></td>
          </tr>`;
                })
                .join("")
            : `<tr><td colspan="5">Aucun objectif d'épargne enregistré.</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">E. Dettes à Rembourser & Créances à Récupérer</div>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Personne</th>
          <th class="right">Montant Initial</th>
          <th class="right">Reste</th>
          <th>Échéance</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        ${
          debts.length > 0
            ? debts
                .map(
                  (d) => `
          <tr>
            <td>${d.type === "payable" ? "Je dois (Dette)" : "On me doit (Créance)"}</td>
            <td>${d.personName}</td>
            <td class="right">${formatMoney(d.totalAmount, currency)}</td>
            <td class="right"><strong>${formatMoney(d.remainingAmount, currency)}</strong></td>
            <td>${d.dueDate || "-"}</td>
            <td>${d.status === "paid" ? "Soldé" : d.status === "partial" ? "Partiel" : "En cours"}</td>
          </tr>`
                )
                .join("")
            : `<tr><td colspan="6">Aucune dette ou créance enregistrée.</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  const printWin = window.open("", "_blank", "width=960,height=800");
  if (printWin) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  } else {
    // Fallback si le bloqueur de popups est actif : téléchargement direct du rapport HTML imprimable
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeMonth = monthLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    link.href = url;
    link.setAttribute("download", `MonBudget_Rapport_${safeMonth}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

