import {
  formatMoney,
  getTotalExpenses,
  getRemainingToLive,
  getSpentByCategory,
  getMonthlySavingsContributions,
  getTotalPayableDebts,
  getTotalReceivableDebts,
  isIncomeTransaction,
  generateFinancialAIAnalysis,
  type DebtItem,
} from "@/lib/utils/budget-calc";
import { escapeCsvCell, escapeHtml } from "@/lib/utils/security";
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

export interface UnifiedIncomeItem {
  id: string;
  origin: "declared" | "transaction";
  originLabel: string;
  sourceType: string;
  label: string;
  amount: number;
  date: string;
}

export interface UnifiedIncomeBreakdown {
  baseSalaryTotal: number;
  additionalIncomeTotal: number;
  totalRealIncome: number;
  declaredItems: UnifiedIncomeItem[];
  transactionItems: UnifiedIncomeItem[];
  allItems: UnifiedIncomeItem[];
}

/**
 * Construit la ventilation complète et exacte du Revenu Réel du mois :
 * - Salaire de base & sources fixes déclarées (incomeEntries)
 * - Revenus supplémentaires saisis dans les transactions (type === "income")
 * Garantit que la somme correspond à 100% au Revenu Réel Total (income).
 */
export function buildUnifiedIncomeBreakdown(
  income: number,
  incomeEntries: IncomeSourceEntry[],
  transactions: Transaction[]
): UnifiedIncomeBreakdown {
  const incomeTransactions = transactions.filter((tx) => isIncomeTransaction(tx));
  const additionalIncomeTotal = incomeTransactions.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  );

  const declaredEntriesSum = (incomeEntries || []).reduce(
    (sum, entry) => sum + (Number(entry.amount) || 0),
    0
  );

  const inferredBaseSalary = Math.max(0, (Number(income) || 0) - additionalIncomeTotal);
  const baseSalaryTotal =
    declaredEntriesSum > 0 ? Math.max(declaredEntriesSum, inferredBaseSalary) : inferredBaseSalary;

  const declaredItems: UnifiedIncomeItem[] = [];
  if (incomeEntries && incomeEntries.length > 0) {
    for (const entry of incomeEntries) {
      declaredItems.push({
        id: entry.id || `inc-decl-${declaredItems.length}`,
        origin: "declared",
        originLabel: "Salaire / Revenu fixe",
        sourceType: entry.sourceType || "Salaire",
        label: entry.label || "Salaire principal",
        amount: Number(entry.amount) || 0,
        date: entry.date || "-",
      });
    }
    if (inferredBaseSalary > declaredEntriesSum) {
      declaredItems.push({
        id: "inc-decl-complement",
        origin: "declared",
        originLabel: "Salaire / Revenu fixe",
        sourceType: "Salaire",
        label: "Complément revenu fixe déclaré",
        amount: inferredBaseSalary - declaredEntriesSum,
        date: "-",
      });
    }
  } else if (baseSalaryTotal > 0) {
    declaredItems.push({
      id: "inc-decl-main",
      origin: "declared",
      originLabel: "Salaire / Revenu fixe",
      sourceType: "Salaire",
      label: "Salaire principal déclaré",
      amount: baseSalaryTotal,
      date: "-",
    });
  }

  const transactionItems: UnifiedIncomeItem[] = incomeTransactions.map((tx, idx) => ({
    id: tx.id || `inc-tx-${idx}`,
    origin: "transaction",
    originLabel: "Revenu supplémentaire",
    sourceType:
      tx.category && tx.category !== "Revenu" ? tx.category : "Revenu supplémentaire",
    label: tx.label || "Entrée additionnelle",
    amount: Number(tx.amount) || 0,
    date: tx.date || "-",
  }));

  const allItems = [...declaredItems, ...transactionItems];
  const computedSum = baseSalaryTotal + additionalIncomeTotal;
  const totalRealIncome = Math.max(Number(income) || 0, computedSum);

  return {
    baseSalaryTotal,
    additionalIncomeTotal,
    totalRealIncome,
    declaredItems,
    transactionItems,
    allItems,
  };
}

export { escapeCsvCell };

/**
 * Télécharge un rapport financier complet au format CSV standard RFC 4180 (séparateur virgule + UTF-8 BOM)
 * S'ouvre directement en vraies colonnes séparées dans Google Sheets, Excel, LibreOffice et Numbers,
 * avec exactement le même niveau de détail que le rapport PDF.
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

  const incomeBreakdown = buildUnifiedIncomeBreakdown(income, incomeEntries, transactions);
  const realIncome = incomeBreakdown.totalRealIncome;
  const monthlySavings = getMonthlySavingsContributions(savingsGoals, year, month);
  const totalExpenses = getTotalExpenses(transactions, monthlySavings);
  const directExpensesOnly = Math.max(0, totalExpenses - monthlySavings);
  const totalSavingsAccumulated = savingsGoals.reduce((sum, g) => sum + (Number(g.current) || 0), 0);
  const remaining = getRemainingToLive(realIncome, totalExpenses);
  const payableDebts = getTotalPayableDebts(debts);
  const receivableDebts = getTotalReceivableDebts(debts);

  const aiAnalysis = generateFinancialAIAnalysis({
    income: realIncome,
    incomeSourcesCount: Math.max(1, incomeBreakdown.allItems.length),
    categories,
    transactions,
    savingsGoals,
    debts,
    monthlySavings,
    currency,
  });

  const rows: string[][] = [];

  // En-tête du document
  rows.push([
    `RAPPORT FINANCIER MENSUEL — MONBUDGET (${monthLabel.toUpperCase()})`,
    "",
    "",
    "",
    "",
    "",
  ]);
  rows.push([
    "Période",
    monthLabel,
    "Généré le",
    new Date().toLocaleDateString("fr-FR"),
    "Devise",
    currency,
  ]);
  rows.push([]);

  // 1. SYNTHÈSE DES FLUX & INDICATEURS CLÉS
  rows.push(["1. BILAN FINANCIER GLOBAL DU MOIS", "", "", "", "", ""]);
  rows.push([
    "Indicateur",
    `Montant (${currency})`,
    "Montant Formaté",
    "Part / Ratio",
    "Détail & Composition",
    "Statut",
  ]);
  rows.push([
    "Revenu Total Réel (Salaire + Suppléments)",
    String(Math.round(realIncome)),
    formatMoney(realIncome, currency),
    "100%",
    `Salaire/Fixe : ${formatMoney(incomeBreakdown.baseSalaryTotal, currency)} + Suppléments : ${formatMoney(incomeBreakdown.additionalIncomeTotal, currency)}`,
    `${incomeBreakdown.allItems.length} source(s) au total`,
  ]);
  rows.push([
    "  • dont Salaire & Sources fixes déclarées",
    String(Math.round(incomeBreakdown.baseSalaryTotal)),
    formatMoney(incomeBreakdown.baseSalaryTotal, currency),
    realIncome > 0 ? `${Math.round((incomeBreakdown.baseSalaryTotal / realIncome) * 100)}%` : "0%",
    `${incomeBreakdown.declaredItems.length} source(s) déclarée(s) dans Mon Budget`,
    "Revenu de base",
  ]);
  rows.push([
    "  • dont Revenus supplémentaires (Transactions)",
    String(Math.round(incomeBreakdown.additionalIncomeTotal)),
    formatMoney(incomeBreakdown.additionalIncomeTotal, currency),
    realIncome > 0 ? `${Math.round((incomeBreakdown.additionalIncomeTotal / realIncome) * 100)}%` : "0%",
    `${incomeBreakdown.transactionItems.length} entrée(s) additionnelle(s) ce mois`,
    incomeBreakdown.additionalIncomeTotal > 0 ? "Revenu additionnel actif" : "Aucun supplément",
  ]);
  rows.push([
    "Dépenses Totales Engagées (Sorties + Épargne)",
    String(Math.round(totalExpenses)),
    formatMoney(totalExpenses, currency),
    realIncome > 0 ? `${Math.round((totalExpenses / realIncome) * 100)}% du revenu` : "0%",
    `Sorties directes : ${formatMoney(directExpensesOnly, currency)} | Épargne : ${formatMoney(monthlySavings, currency)}`,
    totalExpenses <= realIncome ? "Maîtrisé" : "Dépassement",
  ]);
  rows.push([
    "Solde Net Disponible (Reste après transactions)",
    String(Math.round(remaining)),
    formatMoney(remaining, currency),
    realIncome > 0 ? `${Math.round((remaining / realIncome) * 100)}% du revenu` : "0%",
    `${formatMoney(realIncome, currency)} (Revenu Réel) - ${formatMoney(totalExpenses, currency)} (Dépenses)`,
    remaining >= 0 ? "Excédent disponible" : "Déficit budgétaire",
  ]);
  rows.push([
    "Épargne versée ce mois",
    String(Math.round(monthlySavings)),
    formatMoney(monthlySavings, currency),
    realIncome > 0 ? `${Math.round((monthlySavings / realIncome) * 100)}% du revenu` : "0%",
    `Épargne totale cumulée : ${formatMoney(totalSavingsAccumulated, currency)}`,
    monthlySavings > 0 ? "Épargne active" : "Aucun versement ce mois",
  ]);
  rows.push([
    "Dettes à rembourser (Je dois)",
    String(Math.round(payableDebts)),
    formatMoney(payableDebts, currency),
    "-",
    "Reste total à payer à vos créanciers",
    payableDebts > 0 ? "En cours" : "Aucune dette",
  ]);
  rows.push([
    "Créances à récupérer (On me doit)",
    String(Math.round(receivableDebts)),
    formatMoney(receivableDebts, currency),
    "-",
    "Créances totales à encaisser",
    receivableDebts > 0 ? "À recouvrer" : "Aucune créance",
  ]);
  rows.push([
    "Score de Santé Financière (IA)",
    `${aiAnalysis.healthScore}/100`,
    aiAnalysis.healthLabel,
    "-",
    aiAnalysis.summary,
    aiAnalysis.healthLabel,
  ]);
  rows.push([]);

  // 2. DÉTAIL COMPLET DES SOURCES DE REVENUS (SALAIRE + REVENUS SUPPLÉMENTAIRES)
  rows.push([
    "2. DÉTAIL COMPLET DES REVENUS (SALAIRE + REVENUS SUPPLÉMENTAIRES)",
    "",
    "",
    "",
    "",
    "",
  ]);
  rows.push([
    "Origine",
    "Catégorie / Source",
    "Libellé",
    `Montant (${currency})`,
    "Montant Formaté",
    "Date",
  ]);
  if (incomeBreakdown.allItems.length > 0) {
    for (const item of incomeBreakdown.allItems) {
      rows.push([
        item.originLabel,
        item.sourceType,
        item.label,
        String(Math.round(item.amount)),
        formatMoney(item.amount, currency),
        item.date,
      ]);
    }
  } else {
    rows.push([
      "Salaire / Revenu fixe",
      "Salaire",
      "Revenu mensuel déclaré",
      String(Math.round(realIncome)),
      formatMoney(realIncome, currency),
      "-",
    ]);
  }
  rows.push([
    "SOUS-TOTAL",
    "Salaire & Sources fixes",
    `${incomeBreakdown.declaredItems.length} source(s) fixe(s)`,
    String(Math.round(incomeBreakdown.baseSalaryTotal)),
    formatMoney(incomeBreakdown.baseSalaryTotal, currency),
    "-",
  ]);
  rows.push([
    "SOUS-TOTAL",
    "Revenus supplémentaires",
    `${incomeBreakdown.transactionItems.length} transaction(s) de revenu`,
    String(Math.round(incomeBreakdown.additionalIncomeTotal)),
    formatMoney(incomeBreakdown.additionalIncomeTotal, currency),
    "-",
  ]);
  rows.push([
    "TOTAL REVENU RÉEL",
    "Toutes sources confondues",
    "Salaire + Revenus supplémentaires",
    String(Math.round(realIncome)),
    formatMoney(realIncome, currency),
    monthLabel,
  ]);
  rows.push([]);

  // 3. ENVELOPPES BUDGÉTAIRES & DÉPENSES PAR CATÉGORIE
  rows.push(["3. GESTION DES ENVELOPPES & DÉPENSES PAR CATÉGORIE", "", "", "", "", ""]);
  rows.push([
    "Catégorie",
    `Budget Alloué (${currency})`,
    `Dépensé Réel (${currency})`,
    `Reste Disponible (${currency})`,
    "Taux Consommé (%)",
    "Statut",
  ]);
  let totalAllocatedSum = 0;
  let totalSpentSum = 0;
  for (const cat of categories) {
    const spent = getSpentByCategory(transactions, cat.name);
    const allocated = Number(cat.amount) || 0;
    const catRemaining = allocated - spent;
    totalAllocatedSum += allocated;
    totalSpentSum += spent;
    const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : spent > 0 ? 100 : 0;
    const statusLabel =
      spent > allocated
        ? "Dépassement"
        : pct >= 85
          ? "Attention (proche plafond)"
          : spent > 0
            ? "Maîtrisé"
            : "Non entamé";
    rows.push([
      cat.name,
      String(Math.round(allocated)),
      String(Math.round(spent)),
      String(Math.round(catRemaining)),
      `${pct}%`,
      statusLabel,
    ]);
  }
  const totalDiffSum = totalAllocatedSum - totalSpentSum;
  const totalCatPct =
    totalAllocatedSum > 0 ? Math.round((totalSpentSum / totalAllocatedSum) * 100) : 0;
  rows.push([
    "TOTAL DES ENVELOPPES",
    String(Math.round(totalAllocatedSum)),
    String(Math.round(totalSpentSum)),
    String(Math.round(totalDiffSum)),
    `${totalCatPct}%`,
    totalDiffSum >= 0 ? "Budget respecté" : "Dépassement global",
  ]);
  rows.push([]);

  // 4. OBJECTIFS D'ÉPARGNE
  rows.push(["4. PROGRESSION DES OBJECTIFS D'ÉPARGNE", "", "", "", "", ""]);
  rows.push([
    "Objectif",
    `Cible (${currency})`,
    `Épargne Constituée (${currency})`,
    `Reste à Épargner (${currency})`,
    "Progression (%)",
    "Statut",
  ]);
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
        pct >= 100 ? "Objectif atteint" : "En cours",
      ]);
    }
  } else {
    rows.push(["Aucun objectif d'épargne configuré", "0", "0", "0", "0%", "-"]);
  }
  rows.push([]);

  // 5. DETTES & CRÉANCES
  rows.push(["5. ÉTAT DES DETTES & CRÉANCES", "", "", "", "", ""]);
  rows.push([
    "Type",
    "Personne / Tiers",
    `Montant Initial (${currency})`,
    `Reste (${currency})`,
    "Échéance",
    "Statut",
  ]);
  if (debts.length > 0) {
    for (const d of debts) {
      rows.push([
        d.type === "payable" ? "Dette (Je dois)" : "Créance (On me doit)",
        d.personName,
        String(Math.round(d.totalAmount)),
        String(Math.round(d.remainingAmount)),
        d.dueDate || "-",
        d.status === "paid" ? "Soldé" : d.status === "partial" ? "Partiel" : "En attente",
      ]);
    }
  } else {
    rows.push(["Aucune dette ou créance enregistrée", "-", "0", "0", "-", "-"]);
  }
  rows.push([]);

  // 6. JOURNAL DES TRANSACTIONS DU MOIS
  rows.push(["6. JOURNAL DÉTAILLÉ DES TRANSACTIONS DU MOIS", "", "", "", "", ""]);
  rows.push([
    "Date",
    "Type d'opération",
    "Catégorie / Poste",
    "Libellé",
    `Montant (${currency})`,
    "Montant Formaté",
  ]);
  if (transactions.length > 0) {
    const sortedTx = [...transactions].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    for (const tx of sortedTx) {
      const isInc = isIncomeTransaction(tx);
      const signedAmount = isInc ? Math.round(tx.amount) : -Math.round(tx.amount);
      rows.push([
        tx.date || "-",
        isInc ? "Revenu supplémentaire (+)" : "Dépense (-)",
        isInc ? (tx.category || "Revenu supplémentaire") : (tx.category || "Autre"),
        tx.label || "-",
        String(signedAmount),
        `${isInc ? "+" : "-"}${formatMoney(tx.amount, currency)}`,
      ]);
    }
  } else {
    rows.push(["-", "Aucune transaction", "-", "Aucune opération enregistrée ce mois", "0", `0 ${currency}`]);
  }
  rows.push([]);

  // 7. RECOMMANDATIONS IA
  rows.push(["7. RECOMMANDATIONS DU CONSEILLER FINANCIER IA", "", "", "", "", ""]);
  rows.push(["Priorité", "Domaine", "Titre", "Action recommandée", "", ""]);
  for (const rec of aiAnalysis.recommendations) {
    rows.push([
      rec.priority.toUpperCase(),
      rec.category,
      rec.title,
      rec.description,
      "",
      "",
    ]);
  }

  // Standard RFC 4180 : séparateur virgule (,) + guillemets échappés pour compatibilité directe Google Sheets & Excel
  const csvContent = "\uFEFF" + rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
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

  const incomeBreakdown = buildUnifiedIncomeBreakdown(income, incomeEntries, transactions);
  const realIncome = incomeBreakdown.totalRealIncome;
  const monthlySavings = getMonthlySavingsContributions(savingsGoals, year, month);
  const totalExpenses = getTotalExpenses(transactions, monthlySavings);
  const directExpensesOnly = Math.max(0, totalExpenses - monthlySavings);
  const totalSavingsAccumulated = savingsGoals.reduce((sum, g) => sum + (Number(g.current) || 0), 0);
  const remaining = getRemainingToLive(realIncome, totalExpenses);
  const payableDebts = getTotalPayableDebts(debts);
  const receivableDebts = getTotalReceivableDebts(debts);

  const aiAnalysis = generateFinancialAIAnalysis({
    income: realIncome,
    incomeSourcesCount: Math.max(1, incomeBreakdown.allItems.length),
    categories,
    transactions,
    savingsGoals,
    debts,
    monthlySavings,
    currency,
  });

  const safeMonthLabel = escapeHtml(monthLabel);
  const safeCurrency = escapeHtml(currency);
  const safeHealthLabel = escapeHtml(aiAnalysis.healthLabel);
  const safeAiSummary = escapeHtml(aiAnalysis.summary);

  const totalAllocatedSum = categories.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const totalCatSpentSum = categories.reduce((s, c) => s + getSpentByCategory(transactions, c.name), 0);
  const totalCatDiffSum = totalAllocatedSum - totalCatSpentSum;
  const totalCatPct =
    totalAllocatedSum > 0 ? Math.round((totalCatSpentSum / totalAllocatedSum) * 100) : 0;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Rapport Financier MonBudget - ${safeMonthLabel}</title>
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
    .kpi-sub {
      font-size: 10px;
      color: #475569;
      margin-top: 2px;
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
    tfoot td {
      background: #f8fafc;
      font-weight: 800;
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
    <span>📄 <strong>Aperçu du Rapport PDF (${safeMonthLabel})</strong> — Choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.</span>
    <button onclick="window.print()" style="background:#10b981; color:#fff; border:none; padding:6px 14px; border-radius:6px; font-weight:700; cursor:pointer;">Imprimer / Enregistrer en PDF</button>
  </div>

  <div class="header">
    <div>
      <div class="brand">MonBudget — Rapport Financier Mensuel</div>
      <div class="subtitle">Période : <strong>${safeMonthLabel}</strong></div>
    </div>
    <div class="meta">
      <div>Édité le ${escapeHtml(new Date().toLocaleDateString("fr-FR"))}</div>
      <div>Devise : <strong>${safeCurrency}</strong></div>
      <div>Score Santé IA : <strong>${Number(aiAnalysis.healthScore) || 0}/100 (${safeHealthLabel})</strong></div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">1. Revenu Total Réel du mois</div>
      <div class="kpi-value" style="color:#059669;">${escapeHtml(formatMoney(realIncome, currency))}</div>
      <div class="kpi-sub">Salaire/Fixe : ${escapeHtml(formatMoney(incomeBreakdown.baseSalaryTotal, currency))} | Suppl. : +${escapeHtml(formatMoney(incomeBreakdown.additionalIncomeTotal, currency))}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">2. Dépenses Totales du mois</div>
      <div class="kpi-value" style="color:#dc2626;">${escapeHtml(formatMoney(totalExpenses, currency))}</div>
      <div class="kpi-sub">Sorties : ${escapeHtml(formatMoney(directExpensesOnly, currency))} | Épargne : ${escapeHtml(formatMoney(monthlySavings, currency))}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">3. Solde Disponible (Reste à vivre)</div>
      <div class="kpi-value" style="color:${remaining < 0 ? "#dc2626" : "#1E3A5F"};">${escapeHtml(formatMoney(remaining, currency))}</div>
      <div class="kpi-sub">${remaining >= 0 ? "Reste en caisse après transactions" : "Dépassement budgétaire"}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">4. Épargne Constituée (Cumul)</div>
      <div class="kpi-value" style="color:#0284c7;">${escapeHtml(formatMoney(totalSavingsAccumulated, currency))}</div>
      <div class="kpi-sub">Versé ce mois : ${escapeHtml(formatMoney(monthlySavings, currency))}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">5. Dettes à rembourser (Je dois)</div>
      <div class="kpi-value" style="color:#e11d48;">${escapeHtml(formatMoney(payableDebts, currency))}</div>
      <div class="kpi-sub">Reste total à payer</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">6. Créances à récupérer (On me doit)</div>
      <div class="kpi-value" style="color:#d97706;">${escapeHtml(formatMoney(receivableDebts, currency))}</div>
      <div class="kpi-sub">Total à encaisser</div>
    </div>
  </div>

  <div class="ai-box">
    <div style="font-weight:800; color:#312e81; margin-bottom:4px;">
      🤖 Diagnostic de l'Intelligence Artificielle Financière (${Number(aiAnalysis.healthScore) || 0}/100 — ${safeHealthLabel})
    </div>
    <div style="margin-bottom:8px;">${safeAiSummary}</div>
    ${aiAnalysis.recommendations
      .map(
        (rec) => `
      <div class="ai-rec">
        <strong>${escapeHtml(rec.title)} :</strong> ${escapeHtml(rec.description)}
      </div>`
      )
      .join("")}
  </div>

  <div class="section">
    <div class="section-title">B. Détail Complet des Sources de Revenus (${safeMonthLabel})</div>
    <table>
      <thead>
        <tr>
          <th>Origine</th>
          <th>Source / Catégorie</th>
          <th>Libellé</th>
          <th>Date</th>
          <th class="right">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${
          incomeBreakdown.allItems.length > 0
            ? incomeBreakdown.allItems
                .map(
                  (inc) => `
          <tr>
            <td>${escapeHtml(inc.originLabel)}</td>
            <td>${escapeHtml(inc.sourceType)}</td>
            <td>${escapeHtml(inc.label)}</td>
            <td>${escapeHtml(inc.date)}</td>
            <td class="right"><strong>${escapeHtml(formatMoney(inc.amount, currency))}</strong></td>
          </tr>`
                )
                .join("")
            : `
          <tr>
            <td>Salaire / Revenu fixe</td>
            <td>Salaire</td>
            <td>Revenu mensuel déclaré</td>
            <td>-</td>
            <td class="right"><strong>${escapeHtml(formatMoney(realIncome, currency))}</strong></td>
          </tr>`
        }
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4">Salaire & Sources fixes déclarées</td>
          <td class="right">${escapeHtml(formatMoney(incomeBreakdown.baseSalaryTotal, currency))}</td>
        </tr>
        <tr>
          <td colspan="4">Revenus supplémentaires (Transactions du mois)</td>
          <td class="right" style="color:#059669;">+${escapeHtml(formatMoney(incomeBreakdown.additionalIncomeTotal, currency))}</td>
        </tr>
        <tr>
          <td colspan="4" style="color:#1E3A5F;">TOTAL REVENU RÉEL DU MOIS</td>
          <td class="right" style="color:#059669; font-size:12px;">${escapeHtml(formatMoney(realIncome, currency))}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="section">
    <div class="section-title">C. Dépenses par Catégorie (Enveloppes Budgétaires)</div>
    <table>
      <thead>
        <tr>
          <th>Catégorie</th>
          <th class="right">Budget Alloué</th>
          <th class="right">Dépensé Réel</th>
          <th class="right">Reste Disponible</th>
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
            <td>${escapeHtml(cat.name)}</td>
            <td class="right">${escapeHtml(formatMoney(allocated, currency))}</td>
            <td class="right">${escapeHtml(formatMoney(spent, currency))}</td>
            <td class="right" style="color:${diff < 0 ? "#dc2626" : "#059669"};">${escapeHtml(formatMoney(diff, currency))}</td>
            <td class="right">${pct}%</td>
          </tr>`;
          })
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td>TOTAL DES ENVELOPPES</td>
          <td class="right">${escapeHtml(formatMoney(totalAllocatedSum, currency))}</td>
          <td class="right">${escapeHtml(formatMoney(totalCatSpentSum, currency))}</td>
          <td class="right" style="color:${totalCatDiffSum < 0 ? "#dc2626" : "#059669"};">${escapeHtml(formatMoney(totalCatDiffSum, currency))}</td>
          <td class="right">${totalCatPct}%</td>
        </tr>
      </tfoot>
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
            <td>${escapeHtml(g.name)}</td>
            <td class="right">${escapeHtml(formatMoney(g.target, currency))}</td>
            <td class="right">${escapeHtml(formatMoney(g.current, currency))}</td>
            <td class="right">${escapeHtml(formatMoney(Math.max(0, g.target - g.current), currency))}</td>
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
            <td>${escapeHtml(d.personName)}</td>
            <td class="right">${escapeHtml(formatMoney(d.totalAmount, currency))}</td>
            <td class="right"><strong>${escapeHtml(formatMoney(d.remainingAmount, currency))}</strong></td>
            <td>${escapeHtml(d.dueDate || "-")}</td>
            <td>${d.status === "paid" ? "Soldé" : d.status === "partial" ? "Partiel" : "En cours"}</td>
          </tr>`
                )
                .join("")
            : `<tr><td colspan="6">Aucune dette ou créance enregistrée.</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">F. Journal des Transactions du Mois (${safeMonthLabel})</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Catégorie</th>
          <th>Libellé</th>
          <th class="right">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${
          transactions.length > 0
            ? [...transactions]
                .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                .map((tx) => {
                  const isInc = isIncomeTransaction(tx);
                  return `
          <tr>
            <td>${escapeHtml(tx.date || "-")}</td>
            <td style="color:${isInc ? "#059669" : "#475569"}; font-weight:600;">${isInc ? "Revenu suppl. (+)" : "Dépense (-)"}</td>
            <td>${escapeHtml(isInc ? (tx.category || "Revenu supplémentaire") : (tx.category || "Autre"))}</td>
            <td>${escapeHtml(tx.label || "-")}</td>
            <td class="right" style="color:${isInc ? "#059669" : "#0f172a"}; font-weight:700;">${isInc ? "+" : "-"}${escapeHtml(formatMoney(tx.amount, currency))}</td>
          </tr>`;
                })
                .join("")
            : `<tr><td colspan="5">Aucune transaction enregistrée pour ce mois.</td></tr>`
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
