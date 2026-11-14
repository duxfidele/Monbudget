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
import { escapeCsvCell } from "@/lib/utils/security";
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
 * S'ouvre directement en vraies colonnes séparées dans Google Sheets, Excel, LibreOffice et Numbers.
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
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ============================================================================
// MOTEUR VECTORIEL PDF 1.4 NATIF (A4 PORTRAIT — 100% HORS-LIGNE & TÉLÉCHARGEMENT DIRECT)
// ============================================================================

type RgbColor = [number, number, number]; // Valeurs 0..255
type PdfFontKey = "F1" | "F2" | "F3"; // F1 = Helvetica, F2 = Helvetica-Bold, F3 = Helvetica-Oblique

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 32;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 531.28 pt
const MARGIN_BOTTOM = 44;

const COLORS = {
  navy: [30, 58, 95] as RgbColor, // #1E3A5F
  navyDark: [15, 23, 42] as RgbColor, // #0F172A
  slate700: [51, 65, 85] as RgbColor, // #334155
  slate500: [100, 116, 139] as RgbColor, // #64748B
  slate300: [203, 213, 225] as RgbColor, // #CBD5E1
  slate200: [226, 232, 240] as RgbColor, // #E2E8F0
  slate100: [241, 245, 249] as RgbColor, // #F1F5F9
  slate50: [248, 250, 252] as RgbColor, // #F8FAFC
  white: [255, 255, 255] as RgbColor,
  sky200: [186, 230, 253] as RgbColor, // #BAE6FD
  sky600: [2, 132, 199] as RgbColor, // #0284C7
  emerald600: [5, 150, 105] as RgbColor, // #059669
  emerald500: [16, 185, 129] as RgbColor, // #10B981
  emerald50: [236, 253, 245] as RgbColor, // #ECFDF5
  red600: [220, 38, 38] as RgbColor, // #DC2626
  rose600: [225, 29, 72] as RgbColor, // #E11D48
  amber600: [217, 119, 6] as RgbColor, // #D97706
  indigo600: [79, 70, 229] as RgbColor, // #4F46E5
  indigo900: [49, 46, 129] as RgbColor, // #312E81
  indigo50: [238, 242, 255] as RgbColor, // #EEF2FF
  indigo200: [199, 210, 254] as RgbColor, // #C7D2FE
};

const WIN_ANSI_SPECIAL_MAP: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

/**
 * Normalise une chaîne pour le rendu PDF WinAnsi (espaces insécables de formatMoney, apostrophes, tirets)
 */
function normalizePdfText(input: unknown): string {
  return String(input ?? "")
    .replace(/[\u00A0\u202F\u2007\u2009]/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
}

/**
 * Convertit une chaîne Unicode en littéral PDF (...) encodé en WinAnsi avec séquences octales \ddd
 * Garantit que le flux PDF est 100% ASCII pur tout en affichant parfaitement les accents français.
 */
function encodePdfWinAnsiLiteral(text: string): string {
  const clean = normalizePdfText(text);
  let out = "(";
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if (code === 0x28) {
      out += "\\(";
    } else if (code === 0x29) {
      out += "\\)";
    } else if (code === 0x5c) {
      out += "\\\\";
    } else if (code >= 0x20 && code <= 0x7e) {
      out += clean[i];
    } else if (WIN_ANSI_SPECIAL_MAP[code] !== undefined) {
      const byte = WIN_ANSI_SPECIAL_MAP[code];
      out += "\\" + byte.toString(8).padStart(3, "0");
    } else if (code >= 0xa0 && code <= 0xff) {
      out += "\\" + code.toString(8).padStart(3, "0");
    } else {
      // Ignore les emojis hors WinAnsi
    }
  }
  out += ")";
  return out;
}

/**
 * Estime la largeur en points d'un texte en police Helvetica / Helvetica-Bold
 */
function measurePdfTextWidth(text: string, fontSize: number, bold = false): number {
  const clean = normalizePdfText(text);
  let units = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if ("ilI.,:;|!1' ".includes(ch)) {
      units += bold ? 0.31 : 0.28;
    } else if ("ftrj()-[]/".includes(ch)) {
      units += bold ? 0.38 : 0.34;
    } else if ("mwMW@%".includes(ch)) {
      units += bold ? 0.86 : 0.82;
    } else if (ch >= "A" && ch <= "Z") {
      units += bold ? 0.70 : 0.66;
    } else if (ch >= "0" && ch <= "9") {
      units += 0.56;
    } else {
      units += bold ? 0.57 : 0.53;
    }
  }
  return units * fontSize;
}

/**
 * Tronque proprement un texte s'il dépasse la largeur maximale disponible
 */
function fitPdfText(text: string, maxWidth: number, fontSize: number, bold = false): string {
  const clean = normalizePdfText(text);
  if (measurePdfTextWidth(clean, fontSize, bold) <= maxWidth) {
    return clean;
  }
  const ellipsis = "...";
  const ellipsisW = measurePdfTextWidth(ellipsis, fontSize, bold);
  let sliced = clean;
  while (sliced.length > 1 && measurePdfTextWidth(sliced, fontSize, bold) + ellipsisW > maxWidth) {
    sliced = sliced.slice(0, -1);
  }
  return sliced.trimEnd() + ellipsis;
}

/**
 * Découpe un paragraphe en plusieurs lignes respectant maxWidth
 */
function wrapPdfText(text: string, maxWidth: number, fontSize: number, bold = false): string[] {
  const clean = normalizePdfText(text);
  if (!clean) return [""];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measurePdfTextWidth(candidate, fontSize, bold) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = word;
      } else {
        lines.push(fitPdfText(word, maxWidth, fontSize, bold));
        current = "";
      }
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function fmtNum(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function rgbFillCmd(c: RgbColor): string {
  return `${fmtNum(c[0] / 255)} ${fmtNum(c[1] / 255)} ${fmtNum(c[2] / 255)} rg`;
}

function rgbStrokeCmd(c: RgbColor): string {
  return `${fmtNum(c[0] / 255)} ${fmtNum(c[1] / 255)} ${fmtNum(c[2] / 255)} RG`;
}

interface TableColumnSpec {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

interface TableCellSpec {
  text: string;
  color?: RgbColor;
  bold?: boolean;
}

/**
 * Génère les octets binaires (%PDF-1.4) du Rapport Financier Mensuel MonBudget.
 */
export function generateMonthlyReportPdfBytes(payload: ReportExportPayload): Uint8Array {
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

  const tauxDepense = realIncome > 0 ? Math.round((totalExpenses / realIncome) * 100) : 0;
  const tauxEpargne = realIncome > 0 ? Math.round((monthlySavings / realIncome) * 100) : 0;
  const tauxDispo = realIncome > 0 ? Math.max(0, Math.round((remaining / realIncome) * 100)) : 0;

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

  const pages: string[][] = [[]];
  let currentPageIdx = 0;
  let cursorY = 26;

  const emit = (cmd: string) => {
    pages[currentPageIdx].push(cmd);
  };

  const drawRect = (
    x: number,
    topY: number,
    w: number,
    h: number,
    fill?: RgbColor,
    stroke?: RgbColor,
    lineWidth = 0.6
  ) => {
    const pdfY = PAGE_HEIGHT - topY - h;
    if (fill && stroke) {
      emit(`${ lineWidth } w ${rgbFillCmd(fill)} ${rgbStrokeCmd(stroke)} ${fmtNum(x)} ${fmtNum(pdfY)} ${fmtNum(w)} ${fmtNum(h)} re B`);
    } else if (fill) {
      emit(`${rgbFillCmd(fill)} ${fmtNum(x)} ${fmtNum(pdfY)} ${fmtNum(w)} ${fmtNum(h)} re f`);
    } else if (stroke) {
      emit(`${lineWidth} w ${rgbStrokeCmd(stroke)} ${fmtNum(x)} ${fmtNum(pdfY)} ${fmtNum(w)} ${fmtNum(h)} re S`);
    }
  };

  const drawLine = (
    x1: number,
    topY1: number,
    x2: number,
    topY2: number,
    stroke: RgbColor,
    lineWidth = 0.6
  ) => {
    const py1 = PAGE_HEIGHT - topY1;
    const py2 = PAGE_HEIGHT - topY2;
    emit(`${lineWidth} w ${rgbStrokeCmd(stroke)} ${fmtNum(x1)} ${fmtNum(py1)} m ${fmtNum(x2)} ${fmtNum(py2)} l S`);
  };

  const drawText = (
    text: string,
    x: number,
    baselineTopY: number,
    options?: {
      font?: PdfFontKey;
      size?: number;
      color?: RgbColor;
      align?: "left" | "right" | "center";
      maxWidth?: number;
    }
  ) => {
    const font = options?.font || "F1";
    const size = options?.size || 9.5;
    const color = options?.color || COLORS.navyDark;
    const align = options?.align || "left";
    const isBold = font === "F2";
    const finalStr = options?.maxWidth
      ? fitPdfText(text, options.maxWidth, size, isBold)
      : normalizePdfText(text);

    let drawX = x;
    if (align === "right") {
      drawX = x - measurePdfTextWidth(finalStr, size, isBold);
    } else if (align === "center") {
      drawX = x - measurePdfTextWidth(finalStr, size, isBold) / 2;
    }

    const pdfY = PAGE_HEIGHT - baselineTopY;
    emit(
      `BT /${font} ${fmtNum(size)} Tf ${rgbFillCmd(color)} 1 0 0 1 ${fmtNum(drawX)} ${fmtNum(pdfY)} Tm ${encodePdfWinAnsiLiteral(finalStr)} Tj ET`
    );
  };

  const startNewPage = () => {
    pages.push([]);
    currentPageIdx = pages.length - 1;
    cursorY = 26;
    // Bandeau d'en-tête compact sur les pages suivantes
    drawRect(MARGIN_X, cursorY, CONTENT_WIDTH, 26, COLORS.navy);
    drawRect(MARGIN_X, cursorY + 26, CONTENT_WIDTH, 2.5, COLORS.emerald500);
    drawText("MONBUDGET — RAPPORT FINANCIER MENSUEL (SUITE)", MARGIN_X + 10, cursorY + 17, {
      font: "F2",
      size: 10,
      color: COLORS.white,
    });
    drawText(`Période : ${monthLabel}`, MARGIN_X + CONTENT_WIDTH - 10, cursorY + 17, {
      font: "F2",
      size: 9.5,
      color: COLORS.sky200,
      align: "right",
    });
    cursorY += 40;
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      startNewPage();
    }
  };

  const drawSectionHeading = (title: string, subtitle?: string) => {
    ensureSpace(subtitle ? 38 : 28);
    drawRect(MARGIN_X, cursorY, 4, subtitle ? 24 : 16, COLORS.navy);
    drawText(title.toUpperCase(), MARGIN_X + 10, cursorY + 12, {
      font: "F2",
      size: 10.5,
      color: COLORS.navy,
    });
    if (subtitle) {
      drawText(subtitle, MARGIN_X + 10, cursorY + 23, {
        font: "F1",
        size: 8.2,
        color: COLORS.slate500,
      });
      cursorY += 30;
    } else {
      cursorY += 21;
    }
  };

  const drawTable = (
    columns: TableColumnSpec[],
    bodyRows: TableCellSpec[][],
    footerRows?: { cells: TableCellSpec[]; bg?: RgbColor }[]
  ) => {
    const headerH = 21;
    const rowH = 18.5;

    const renderTableHeader = () => {
      drawRect(MARGIN_X, cursorY, CONTENT_WIDTH, headerH, COLORS.navy, COLORS.navy, 0.5);
      let colX = MARGIN_X;
      for (const col of columns) {
        const align = col.align || "left";
        const textX =
          align === "right"
            ? colX + col.width - 6
            : align === "center"
              ? colX + col.width / 2
              : colX + 6;
        drawText(col.header, textX, cursorY + 14, {
          font: "F2",
          size: 8.3,
          color: COLORS.white,
          align,
          maxWidth: col.width - 12,
        });
        colX += col.width;
      }
      cursorY += headerH;
    };

    ensureSpace(headerH + rowH * Math.min(2, Math.max(1, bodyRows.length)));
    renderTableHeader();

    bodyRows.forEach((row, rIdx) => {
      if (cursorY + rowH > PAGE_HEIGHT - MARGIN_BOTTOM) {
        startNewPage();
        renderTableHeader();
      }
      const bg = rIdx % 2 === 1 ? COLORS.slate50 : COLORS.white;
      drawRect(MARGIN_X, cursorY, CONTENT_WIDTH, rowH, bg, COLORS.slate200, 0.4);

      let colX = MARGIN_X;
      row.forEach((cell, cIdx) => {
        const col = columns[cIdx];
        if (!col) return;
        const align = col.align || "left";
        const textX =
          align === "right"
            ? colX + col.width - 6
            : align === "center"
              ? colX + col.width / 2
              : colX + 6;
        drawText(cell.text, textX, cursorY + 12.5, {
          font: cell.bold ? "F2" : "F1",
          size: 8.3,
          color: cell.color || COLORS.navyDark,
          align,
          maxWidth: col.width - 12,
        });
        colX += col.width;
      });
      cursorY += rowH;
    });

    if (footerRows && footerRows.length > 0) {
      for (const fRow of footerRows) {
        if (cursorY + rowH + 2 > PAGE_HEIGHT - MARGIN_BOTTOM) {
          startNewPage();
          renderTableHeader();
        }
        const fBg = fRow.bg || COLORS.slate100;
        drawRect(MARGIN_X, cursorY, CONTENT_WIDTH, rowH + 1.5, fBg, COLORS.slate300, 0.6);
        let colX = MARGIN_X;
        fRow.cells.forEach((cell, cIdx) => {
          const col = columns[cIdx];
          if (!col) return;
          const align = col.align || "left";
          const textX =
            align === "right"
              ? colX + col.width - 6
              : align === "center"
                ? colX + col.width / 2
                : colX + 6;
          drawText(cell.text, textX, cursorY + 13, {
            font: cell.bold !== false ? "F2" : "F1",
            size: 8.6,
            color: cell.color || COLORS.navy,
            align,
            maxWidth: col.width - 12,
          });
          colX += col.width;
        });
        cursorY += rowH + 1.5;
      }
    }

    cursorY += 12;
  };

  // ==========================================================================
  // 1. BANDEAU D'EN-TÊTE OFFICIEL MONBUDGET (PAGE 1)
  // ==========================================================================
  const headerBannerH = 62;
  drawRect(MARGIN_X, cursorY, CONTENT_WIDTH, headerBannerH, COLORS.navy);
  drawRect(MARGIN_X, cursorY + headerBannerH, CONTENT_WIDTH, 3.5, COLORS.emerald500);

  drawText("MONBUDGET — RAPPORT FINANCIER MENSUEL", MARGIN_X + 14, cursorY + 22, {
    font: "F2",
    size: 14.5,
    color: COLORS.white,
  });
  drawText(`Période officielle : ${monthLabel}`, MARGIN_X + 14, cursorY + 38, {
    font: "F2",
    size: 10,
    color: COLORS.sky200,
  });
  drawText(
    "Bilan complet : Salaire, Revenus supplémentaires, Enveloppes budgétaires, Épargne & Transactions",
    MARGIN_X + 14,
    cursorY + 52,
    {
      font: "F1",
      size: 8,
      color: COLORS.slate200,
    }
  );

  // Badge Score Santé IA & métadonnées à droite
  const rightEdge = MARGIN_X + CONTENT_WIDTH - 14;
  drawText(
    `Score Santé IA : ${aiAnalysis.healthScore}/100 (${aiAnalysis.healthLabel})`,
    rightEdge,
    cursorY + 22,
    {
      font: "F2",
      size: 9.5,
      color: COLORS.emerald500,
      align: "right",
    }
  );
  drawText(
    `Édité le ${new Date().toLocaleDateString("fr-FR")}`,
    rightEdge,
    cursorY + 38,
    {
      font: "F1",
      size: 8.5,
      color: COLORS.slate200,
      align: "right",
    }
  );
  drawText(`Devise : ${currency}`, rightEdge, cursorY + 52, {
    font: "F2",
    size: 8.5,
    color: COLORS.white,
    align: "right",
  });

  cursorY += headerBannerH + 16;

  // ==========================================================================
  // 2. SECTION A : GRILLE DES 6 CARTES KPI (2 LIGNES x 3 COLONNES)
  // ==========================================================================
  drawSectionHeading(
    "A. Synthèse Financière & Revenu Réel du Mois",
    "Vue d'ensemble de votre revenu réel (salaire + suppléments), de vos dépenses et de votre solde en caisse"
  );

  const cardGap = 9;
  const cardW = (CONTENT_WIDTH - cardGap * 2) / 3; // ~171.09 pt
  const cardH = 56;

  const kpiCards: {
    label: string;
    value: string;
    valueColor: RgbColor;
    accentColor: RgbColor;
    line1: string;
    line2: string;
  }[] = [
    {
      label: "1. REVENU TOTAL RÉEL",
      value: formatMoney(realIncome, currency),
      valueColor: COLORS.emerald600,
      accentColor: COLORS.emerald500,
      line1: `Salaire / Fixe : ${formatMoney(incomeBreakdown.baseSalaryTotal, currency)}`,
      line2: `Suppléments : +${formatMoney(incomeBreakdown.additionalIncomeTotal, currency)}`,
    },
    {
      label: "2. DÉPENSES ENGAGÉES",
      value: `${formatMoney(totalExpenses, currency)} (${tauxDepense}%)`,
      valueColor: COLORS.red600,
      accentColor: COLORS.red600,
      line1: `Sorties directes : ${formatMoney(directExpensesOnly, currency)}`,
      line2: `Épargne du mois : ${formatMoney(monthlySavings, currency)}`,
    },
    {
      label: "3. SOLDE DISPONIBLE (RESTE)",
      value: formatMoney(remaining, currency),
      valueColor: remaining < 0 ? COLORS.red600 : COLORS.navy,
      accentColor: remaining < 0 ? COLORS.red600 : COLORS.navy,
      line1:
        remaining >= 0
          ? `${tauxDispo}% du revenu réel non dépensé`
          : "Dépassement budgétaire constaté",
      line2: `Revenu (${formatMoney(realIncome, currency)}) - Sorties`,
    },
    {
      label: "4. ÉPARGNE & CAGNOTTES",
      value: formatMoney(totalSavingsAccumulated, currency),
      valueColor: COLORS.sky600,
      accentColor: COLORS.sky600,
      line1: `Versé ce mois : ${formatMoney(monthlySavings, currency)} (${tauxEpargne}%)`,
      line2: `${savingsGoals.length} objectif(s) d'épargne actif(s)`,
    },
    {
      label: "5. DETTES À REMBOURSER",
      value: formatMoney(payableDebts, currency),
      valueColor: COLORS.rose600,
      accentColor: COLORS.rose600,
      line1: "Engagements « Je dois »",
      line2: payableDebts > 0 ? "Reste total à rembourser" : "Aucune dette en cours",
    },
    {
      label: "6. CRÉANCES À RÉCUPÉRER",
      value: formatMoney(receivableDebts, currency),
      valueColor: COLORS.amber600,
      accentColor: COLORS.amber600,
      line1: "Portefeuille « On me doit »",
      line2: receivableDebts > 0 ? "Total restant à encaisser" : "Aucune créance en attente",
    },
  ];

  for (let row = 0; row < 2; row++) {
    const rowTop = cursorY;
    for (let col = 0; col < 3; col++) {
      const card = kpiCards[row * 3 + col];
      const cx = MARGIN_X + col * (cardW + cardGap);
      drawRect(cx, rowTop, cardW, cardH, COLORS.slate50, COLORS.slate300, 0.6);
      drawRect(cx, rowTop, cardW, 3.2, card.accentColor);

      drawText(card.label, cx + 8, rowTop + 14, {
        font: "F2",
        size: 7.5,
        color: COLORS.slate500,
        maxWidth: cardW - 16,
      });
      drawText(card.value, cx + 8, rowTop + 29, {
        font: "F2",
        size: 11.2,
        color: card.valueColor,
        maxWidth: cardW - 16,
      });
      drawText(card.line1, cx + 8, rowTop + 41, {
        font: "F1",
        size: 7.5,
        color: COLORS.slate700,
        maxWidth: cardW - 16,
      });
      drawText(card.line2, cx + 8, rowTop + 51, {
        font: "F1",
        size: 7.3,
        color: COLORS.slate500,
        maxWidth: cardW - 16,
      });
    }
    cursorY += cardH + 8;
  }

  cursorY += 4;

  // ==========================================================================
  // 3. ENCADRÉ DIAGNOSTIC DU CONSEILLER FINANCIER IA
  // ==========================================================================
  const textMaxW = CONTENT_WIDTH - 24;
  const summaryLines = wrapPdfText(aiAnalysis.summary, textMaxW, 8.3, false);
  const recBlocks = aiAnalysis.recommendations.slice(0, 3).map((rec) => {
    const fullRec = `• ${rec.title} : ${rec.description}`;
    return wrapPdfText(fullRec, textMaxW - 6, 8, false);
  });
  const totalRecLines = recBlocks.reduce((s, b) => s + b.length, 0);
  const aiBoxH = 24 + summaryLines.length * 11 + totalRecLines * 10.5 + 8;

  ensureSpace(aiBoxH + 10);
  drawRect(MARGIN_X, cursorY, CONTENT_WIDTH, aiBoxH, COLORS.indigo50, COLORS.indigo200, 0.7);
  drawRect(MARGIN_X, cursorY, 4, aiBoxH, COLORS.indigo600);

  drawText(
    `DIAGNOSTIC DU CONSEILLER FINANCIER IA (${aiAnalysis.healthScore}/100 — ${aiAnalysis.healthLabel})`,
    MARGIN_X + 12,
    cursorY + 14,
    {
      font: "F2",
      size: 9,
      color: COLORS.indigo900,
    }
  );

  let aiLineY = cursorY + 26;
  for (const line of summaryLines) {
    drawText(line, MARGIN_X + 12, aiLineY, {
      font: "F1",
      size: 8.3,
      color: COLORS.navyDark,
    });
    aiLineY += 11;
  }

  aiLineY += 2;
  for (const block of recBlocks) {
    block.forEach((line, idx) => {
      drawText(line, MARGIN_X + (idx === 0 ? 14 : 20), aiLineY, {
        font: idx === 0 ? "F2" : "F1",
        size: 7.9,
        color: COLORS.slate700,
      });
      aiLineY += 10.5;
    });
  }

  cursorY += aiBoxH + 14;

  // ==========================================================================
  // 4. SECTION B : DÉTAIL COMPLET DES SOURCES DE REVENUS
  // ==========================================================================
  drawSectionHeading(
    `B. Détail Complet des Sources de Revenus (${monthLabel})`,
    "Réconciliation exacte entre votre salaire de base déclaré et vos revenus supplémentaires saisis"
  );

  const incomeCols: TableColumnSpec[] = [
    { header: "Origine", width: 120, align: "left" },
    { header: "Catégorie / Source", width: 100, align: "left" },
    { header: "Libellé", width: 141.28, align: "left" },
    { header: "Date", width: 65, align: "center" },
    { header: `Montant (${currency})`, width: 105, align: "right" },
  ];

  const incomeRows: TableCellSpec[][] =
    incomeBreakdown.allItems.length > 0
      ? incomeBreakdown.allItems.map((inc) => [
          {
            text: inc.originLabel,
            color: inc.origin === "declared" ? COLORS.navy : COLORS.emerald600,
            bold: true,
          },
          { text: inc.sourceType },
          { text: inc.label, bold: true },
          { text: inc.date, color: COLORS.slate500 },
          {
            text: `+${formatMoney(inc.amount, currency)}`,
            color: COLORS.emerald600,
            bold: true,
          },
        ])
      : [
          [
            { text: "Salaire / Revenu fixe", color: COLORS.navy, bold: true },
            { text: "Salaire" },
            { text: "Revenu mensuel déclaré", bold: true },
            { text: "-" },
            { text: formatMoney(realIncome, currency), color: COLORS.emerald600, bold: true },
          ],
        ];

  drawTable(incomeCols, incomeRows, [
    {
      cells: [
        { text: "SOUS-TOTAL 1", color: COLORS.slate700 },
        { text: "Salaire & Sources fixes", color: COLORS.slate700 },
        { text: `${incomeBreakdown.declaredItems.length} source(s) déclarée(s)`, color: COLORS.slate500 },
        { text: "-" },
        { text: formatMoney(incomeBreakdown.baseSalaryTotal, currency), color: COLORS.navyDark },
      ],
      bg: COLORS.slate50,
    },
    {
      cells: [
        { text: "SOUS-TOTAL 2", color: COLORS.emerald600 },
        { text: "Revenus supplémentaires", color: COLORS.emerald600 },
        { text: `${incomeBreakdown.transactionItems.length} entrée(s) additionnelle(s)`, color: COLORS.slate500 },
        { text: "-" },
        { text: `+${formatMoney(incomeBreakdown.additionalIncomeTotal, currency)}`, color: COLORS.emerald600 },
      ],
      bg: COLORS.slate50,
    },
    {
      cells: [
        { text: "TOTAL REVENU RÉEL", color: COLORS.navy },
        { text: "Salaire + Suppléments", color: COLORS.navy },
        { text: "Revenu total disponible pour le mois", color: COLORS.slate700 },
        { text: monthLabel, color: COLORS.slate700 },
        { text: formatMoney(realIncome, currency), color: COLORS.emerald600 },
      ],
      bg: COLORS.emerald50,
    },
  ]);

  // ==========================================================================
  // 5. SECTION C : PERFORMANCE DES ENVELOPPES BUDGÉTAIRES
  // ==========================================================================
  drawSectionHeading(
    "C. Suivi & Performance des Enveloppes Budgétaires",
    "Comparaison par catégorie entre le budget alloué, les dépenses réelles et le solde disponible"
  );

  const catCols: TableColumnSpec[] = [
    { header: "Catégorie / Enveloppe", width: 150, align: "left" },
    { header: "Budget Alloué", width: 95, align: "right" },
    { header: "Dépensé Réel", width: 95, align: "right" },
    { header: "Reste Disponible", width: 95, align: "right" },
    { header: "Consommation", width: 96.28, align: "right" },
  ];

  let totalAllocatedSum = 0;
  let totalCatSpentSum = 0;

  const catRows: TableCellSpec[][] = categories.map((cat) => {
    const spent = getSpentByCategory(transactions, cat.name);
    const allocated = Number(cat.amount) || 0;
    const diff = allocated - spent;
    totalAllocatedSum += allocated;
    totalCatSpentSum += spent;
    const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : spent > 0 ? 100 : 0;
    const statusText =
      diff < 0 ? `${pct}% (Dépassé)` : pct >= 85 ? `${pct}% (Attention)` : `${pct}%`;

    return [
      { text: cat.name, bold: true },
      { text: formatMoney(allocated, currency), color: COLORS.slate700 },
      { text: formatMoney(spent, currency), bold: spent > 0 },
      {
        text: formatMoney(diff, currency),
        color: diff < 0 ? COLORS.red600 : COLORS.emerald600,
        bold: true,
      },
      {
        text: statusText,
        color: diff < 0 ? COLORS.red600 : pct >= 85 ? COLORS.amber600 : COLORS.slate700,
        bold: diff < 0 || pct >= 85,
      },
    ];
  });

  const totalCatDiff = totalAllocatedSum - totalCatSpentSum;
  const totalCatPct =
    totalAllocatedSum > 0 ? Math.round((totalCatSpentSum / totalAllocatedSum) * 100) : 0;

  drawTable(catCols, catRows, [
    {
      cells: [
        { text: "TOTAL DES ENVELOPPES", color: COLORS.navy },
        { text: formatMoney(totalAllocatedSum, currency), color: COLORS.navy },
        { text: formatMoney(totalCatSpentSum, currency), color: COLORS.navyDark },
        {
          text: formatMoney(totalCatDiff, currency),
          color: totalCatDiff < 0 ? COLORS.red600 : COLORS.emerald600,
        },
        { text: `${totalCatPct}% consommé`, color: COLORS.navy },
      ],
    },
  ]);

  // ==========================================================================
  // 6. SECTION D : OBJECTIFS D'ÉPARGNE
  // ==========================================================================
  drawSectionHeading(
    "D. Progression des Objectifs d'Épargne",
    "État d'avancement de vos cagnottes et objectifs financiers"
  );

  const savCols: TableColumnSpec[] = [
    { header: "Objectif d'Épargne", width: 165, align: "left" },
    { header: "Montant Cible", width: 95, align: "right" },
    { header: "Épargne Constituée", width: 95, align: "right" },
    { header: "Reste à Épargner", width: 95, align: "right" },
    { header: "Progression", width: 81.28, align: "right" },
  ];

  const savRows: TableCellSpec[][] =
    savingsGoals.length > 0
      ? savingsGoals.map((g) => {
          const target = Number(g.target) || 0;
          const current = Number(g.current) || 0;
          const rest = Math.max(0, target - current);
          const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
          return [
            { text: g.name, bold: true },
            { text: formatMoney(target, currency), color: COLORS.slate700 },
            { text: formatMoney(current, currency), color: COLORS.emerald600, bold: true },
            { text: formatMoney(rest, currency), color: COLORS.slate700 },
            { text: `${pct}%`, color: COLORS.sky600, bold: true },
          ];
        })
      : [
          [
            { text: "Aucun objectif d'épargne configuré", color: COLORS.slate500 },
            { text: "-" },
            { text: "-" },
            { text: "-" },
            { text: "0%" },
          ],
        ];

  drawTable(savCols, savRows);

  // ==========================================================================
  // 7. SECTION E : DETTES & CRÉANCES
  // ==========================================================================
  drawSectionHeading(
    "E. État des Dettes à Rembourser & Créances à Récupérer",
    "Suivi de vos engagements envers des tiers et des sommes que l'on vous doit"
  );

  const debtCols: TableColumnSpec[] = [
    { header: "Nature", width: 105, align: "left" },
    { header: "Personne / Tiers", width: 125, align: "left" },
    { header: "Montant Initial", width: 90, align: "right" },
    { header: "Reste Actuel", width: 90, align: "right" },
    { header: "Échéance", width: 65, align: "center" },
    { header: "Statut", width: 56.28, align: "right" },
  ];

  const debtRows: TableCellSpec[][] =
    debts.length > 0
      ? debts.map((d) => [
          {
            text: d.type === "payable" ? "Je dois (Dette)" : "On me doit (Créance)",
            color: d.type === "payable" ? COLORS.rose600 : COLORS.amber600,
            bold: true,
          },
          { text: d.personName, bold: true },
          { text: formatMoney(d.totalAmount, currency), color: COLORS.slate700 },
          {
            text: formatMoney(d.remainingAmount, currency),
            color: d.type === "payable" ? COLORS.rose600 : COLORS.amber600,
            bold: true,
          },
          { text: d.dueDate || "-", color: COLORS.slate500 },
          {
            text:
              d.status === "paid" ? "Soldé" : d.status === "partial" ? "Partiel" : "En cours",
            bold: true,
          },
        ])
      : [
          [
            { text: "Aucune dette ou créance", color: COLORS.slate500 },
            { text: "-" },
            { text: `0 ${currency}` },
            { text: `0 ${currency}` },
            { text: "-" },
            { text: "-" },
          ],
        ];

  drawTable(debtCols, debtRows);

  // ==========================================================================
  // 8. SECTION F : JOURNAL DÉTAILLÉ DES TRANSACTIONS DU MOIS
  // ==========================================================================
  drawSectionHeading(
    `F. Journal Détaillé des Transactions (${monthLabel})`,
    "Historique complet de vos entrées additionnelles et de vos dépenses du mois"
  );

  const txCols: TableColumnSpec[] = [
    { header: "Date", width: 68, align: "center" },
    { header: "Type", width: 98, align: "left" },
    { header: "Catégorie", width: 105, align: "left" },
    { header: "Libellé de l'opération", width: 155, align: "left" },
    { header: `Montant (${currency})`, width: 105.28, align: "right" },
  ];

  const sortedTx = [...transactions].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const txRows: TableCellSpec[][] =
    sortedTx.length > 0
      ? sortedTx.map((tx) => {
          const isInc = isIncomeTransaction(tx);
          return [
            { text: tx.date || "-", color: COLORS.slate500 },
            {
              text: isInc ? "Revenu suppl. (+)" : "Dépense (-)",
              color: isInc ? COLORS.emerald600 : COLORS.slate700,
              bold: true,
            },
            {
              text: isInc ? tx.category || "Revenu supplémentaire" : tx.category || "Autre",
            },
            { text: tx.label || "-", bold: true },
            {
              text: `${isInc ? "+" : "-"}${formatMoney(tx.amount, currency)}`,
              color: isInc ? COLORS.emerald600 : COLORS.navyDark,
              bold: true,
            },
          ];
        })
      : [
          [
            { text: "-" },
            { text: "Aucune opération", color: COLORS.slate500 },
            { text: "-" },
            { text: "Aucune transaction enregistrée pour ce mois", color: COLORS.slate500 },
            { text: `0 ${currency}` },
          ],
        ];

  drawTable(txCols, txRows);

  // ==========================================================================
  // 9. PIED DE PAGE OFFICIEL SUR CHAQUE PAGE (NUMÉROTATION PAGE X / Y)
  // ==========================================================================
  const totalPages = pages.length;
  for (let p = 0; p < totalPages; p++) {
    currentPageIdx = p;
    const footerLineY = PAGE_HEIGHT - 28;
    drawLine(MARGIN_X, footerLineY, MARGIN_X + CONTENT_WIDTH, footerLineY, COLORS.slate300, 0.5);
    drawText(
      "MonBudget — Application de Gestion Budgétaire & Épargne",
      MARGIN_X,
      footerLineY + 12,
      {
        font: "F3",
        size: 7.8,
        color: COLORS.slate500,
      }
    );
    drawText(
      `Rapport Financier Officiel • ${monthLabel}`,
      MARGIN_X + CONTENT_WIDTH / 2,
      footerLineY + 12,
      {
        font: "F1",
        size: 7.8,
        color: COLORS.slate500,
        align: "center",
      }
    );
    drawText(
      `Page ${p + 1} / ${totalPages}`,
      MARGIN_X + CONTENT_WIDTH,
      footerLineY + 12,
      {
        font: "F2",
        size: 8,
        color: COLORS.navy,
        align: "right",
      }
    );
  }

  // ==========================================================================
  // 10. ASSEMBLAGE DU FICHIER BINAIRE PDF 1.4 (CATALOG, PAGES, FONTS, XREF)
  // ==========================================================================
  // Objet 1 : Catalog
  // Objet 2 : Pages
  // Objet 3 : Font F1 (Helvetica)
  // Objet 4 : Font F2 (Helvetica-Bold)
  // Objet 5 : Font F3 (Helvetica-Oblique)
  // Pour chaque page i (0..totalPages-1) :
  //   Objet (6 + i*2) : Page
  //   Objet (7 + i*2) : Content Stream
  const objects: string[] = [];
  const pageObjNumbers: number[] = [];

  for (let i = 0; i < totalPages; i++) {
    pageObjNumbers.push(6 + i * 2);
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${totalPages} >>\nendobj`
  );
  objects.push(
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`
  );
  objects.push(
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`
  );
  objects.push(
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\nendobj`
  );

  for (let i = 0; i < totalPages; i++) {
    const pageObjNum = 6 + i * 2;
    const contentObjNum = 7 + i * 2;
    const streamContent = pages[i].join("\n");
    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmtNum(PAGE_WIDTH)} ${fmtNum(PAGE_HEIGHT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj`
    );
    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`
    );
  }

  let pdfStr = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(pdfStr.length);
    pdfStr += obj + "\n";
  }

  const xrefStart = pdfStr.length;
  pdfStr += `xref\n0 ${objects.length + 1}\n`;
  pdfStr += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdfStr += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const encoder = new TextEncoder();
  return encoder.encode(pdfStr);
}

/**
 * Génère et télécharge directement le vrai fichier .pdf dans le dossier Téléchargements de l'utilisateur
 */
export function exportMonthlyReportPDF(payload: ReportExportPayload): void {
  const pdfBytes = generateMonthlyReportPdfBytes(payload);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeMonth = payload.monthLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  link.href = url;
  link.setAttribute("download", `MonBudget_Rapport_${safeMonth || "mensuel"}.pdf`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
