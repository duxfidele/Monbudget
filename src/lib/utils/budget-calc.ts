export interface IncomeItem {
  amount: number;
  label?: string;
}

export interface TransactionItem {
  amount: number;
  category?: string;
  type?: "expense" | "income" | "income_adjustment";
  date?: string;
}

export interface CategoryItem {
  id?: string;
  name: string;
  amount: number;
  color?: string;
}

export interface DailyBudgetOptions {
  remainingAmount: number;
  totalIncome?: number;
  targetPayDay?: number; // e.g. 28 (day of month)
  currentDate?: Date;
  todayExpenses?: number; // Total des dépenses enregistrées AUJOURD'HUI
  currency?: string;
}

export interface DailyBudgetResult {
  dailyBudget: number;         // Budget alloué par jour pour aujourd'hui (ex: 10 000 FCFA)
  todaySpent: number;          // Montant déjà déduit aujourd'hui (ex: 3 000 FCFA)
  todayRemaining: number;      // Reste disponible aujourd'hui déduit automatiquement (ex: 7 000 FCFA)
  isOverDailyBudget: boolean;  // Vrai si todaySpent > dailyBudget
  dailyProgressPercent: number;// % consommé du budget du jour (ex: 30%)
  futureDailyBudget: number;   // Moyenne conseillée pour les jours suivants si on s'arrête là
  daysRemaining: number;
  nextPayDate: Date;
  isPayDayToday: boolean;
  status: "healthy" | "warning" | "critical";
  advice: string;
}

/**
 * Calcule le total des revenus
 */
export function getTotalIncome(incomes: IncomeItem[] | number): number {
  if (typeof incomes === "number") return Math.max(0, incomes);
  return incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/**
 * Calcule le total des dépenses réelles
 */

/**
 * Vérifie si une transaction est un revenu (income ou income_adjustment)
 */
export function isIncomeTransaction(tx: TransactionItem): boolean {
  return tx.type === "income" || tx.type === "income_adjustment";
}

/**
 * Vérifie si une transaction est une dépense
 */
export function isExpenseTransaction(tx: TransactionItem): boolean {
  if (tx.type === "income" || tx.type === "income_adjustment") return false;
  return tx.type === "expense" || !tx.type;
}

/**
 * Calcule le total des revenus complémentaires issus des transactions
 */
export function getTotalAdditionalIncome(transactions: TransactionItem[]): number {
  return transactions
    .filter((tx) => isIncomeTransaction(tx))
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
}

/**
 * Vérifie si une transaction est un versement d'épargne (déjà comptabilisé dans l'épargne mensuelle)
 */
export function isSavingsTransaction(tx: TransactionItem & { label?: string }): boolean {
  const cat = (tx.category || "").trim().toLowerCase();
  const lbl = (tx.label || "").trim().toLowerCase();
  return cat === "épargne" || cat === "epargne" || lbl.startsWith("épargne :");
}

export function getTotalExpenses(
  transactions: TransactionItem[],
  monthlySavings: number = 0
): number {
  const regularExpenses = transactions
    .filter((tx) => isExpenseTransaction(tx) && !isSavingsTransaction(tx))
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const txSavings = transactions
    .filter((tx) => isExpenseTransaction(tx) && isSavingsTransaction(tx))
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const effectiveSavings = Math.max(Number(monthlySavings) || 0, txSavings);
  return regularExpenses + effectiveSavings;
}

/**
 * Calcule le total budgété / alloué
 */
export function getTotalAllocated(categories: CategoryItem[]): number {
  return categories.reduce((sum, cat) => sum + (Number(cat.amount) || 0), 0);
}

/**
 * Calcule le montant restant à allouer dans le budget
 */
export function getRemainingToAllocate(income: number, totalAllocated: number): number {
  return income - totalAllocated;
}

/**
 * Calcule le reste à vivre réel (Revenus - Dépenses totales incluant l'épargne)
 */
export function getRemainingToLive(
  income: number,
  totalExpenses: number,
  _optionalSeparateSavings: number = 0
): number {
  return income - totalExpenses;
}

/**
 * Calcule le total dépensé pour une catégorie spécifique
 */
export function getSpentByCategory(
  transactions: TransactionItem[],
  categoryName: string,
  monthlySavings: number = 0
): number {
  const normalized = categoryName.trim().toLowerCase();
  const txSpent = transactions
    .filter(
      (tx) =>
        isExpenseTransaction(tx) &&
        (tx.category || "").trim().toLowerCase() === normalized
    )
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  if ((normalized === "épargne" || normalized === "epargne") && monthlySavings > txSpent) {
    return monthlySavings;
  }
  return txSpent;
}

/**
 * Calcule le total effectivement mobilisé dans Mon Budget :
 * - Pour chaque enveloppe : max(montant budgété, montant réellement dépensé/épargné)
 * - Si l'épargne du mois n'a pas encore d'enveloppe ou dépasse l'enveloppe : elle est comptabilisée automatiquement
 * - Si des dépenses hors-budget existent : elles sont également comptabilisées
 * Cela garantit que le "Reste à allouer" est toujours conforme au "Solde restant".
 */
export function getEffectiveTotalAllocated(
  categories: CategoryItem[],
  transactions: TransactionItem[] = [],
  monthlySavings: number = 0
): number {
  const handledCategories = new Set<string>();
  let total = 0;

  for (const cat of categories) {
    const norm = cat.name.trim().toLowerCase();
    handledCategories.add(norm);
    const budgeted = Math.max(0, Number(cat.amount) || 0);
    const spent = getSpentByCategory(transactions, cat.name, monthlySavings);
    total += Math.max(budgeted, spent);
  }

  // Si aucune enveloppe "Épargne" n'existe encore mais que des épargnes ont été faites ce mois-ci
  if (!handledCategories.has("épargne") && !handledCategories.has("epargne")) {
    const savingsSpent = getSpentByCategory(transactions, "Épargne", monthlySavings);
    total += Math.max(monthlySavings, savingsSpent);
    handledCategories.add("épargne");
    handledCategories.add("epargne");
  }

  // Ajouter toute dépense effectuée sur une catégorie non encore présente dans les enveloppes
  for (const tx of transactions) {
    if (!isExpenseTransaction(tx)) continue;
    if (isSavingsTransaction(tx)) continue; // Déjà compté dans l'épargne ci-dessus
    const normCat = (tx.category || "Autre (Hors Budget)").trim().toLowerCase();
    if (!handledCategories.has(normCat)) {
      total += Number(tx.amount) || 0;
    }
  }

  return total;
}

/**
 * Calcule la progression d'une catégorie budgétaire
 */
export function getCategoryProgress(spent: number, allocated: number) {
  const validAllocated = Math.max(0, allocated);
  const percent = validAllocated > 0 ? (spent / validAllocated) * 100 : spent > 0 ? 100 : 0;
  const isOverBudget = validAllocated > 0 ? spent > validAllocated : spent > 0;
  const remaining = validAllocated - spent;

  return {
    percent: Math.round(percent * 10) / 10,
    isOverBudget,
    remaining,
  };
}

/**
 * Retourne les catégories en alerte ou en dépassement selon le seuil
 */
export function getOverBudgetCategories(
  categories: CategoryItem[],
  transactions: TransactionItem[],
  alertThresholdPercent: number = 80
) {
  return categories
    .map((cat) => {
      const spent = getSpentByCategory(transactions, cat.name);
      const progress = getCategoryProgress(spent, cat.amount);
      return {
        ...cat,
        spent,
        ...progress,
        isWarning: progress.percent >= alertThresholdPercent && !progress.isOverBudget,
      };
    })
    .filter((cat) => cat.isWarning || cat.isOverBudget);
}

/**
 * Calcule le Budget Journalier Conseillé jusqu'à la prochaine paie
 * Formule : Reste à vivre / Jours restants avant la paie
 */
export function getDailyBudget({
  remainingAmount,
  totalIncome = 0,
  targetPayDay = 28,
  currentDate = new Date(),
  todayExpenses = 0,
  currency = "FCFA",
}: DailyBudgetOptions): DailyBudgetResult {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0 to 11
  const currentDay = currentDate.getDate();

  // Nombre de jours dans le mois en cours
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const clampedPayDay = Math.min(Math.max(1, targetPayDay), daysInCurrentMonth);

  let nextPayDate: Date;
  let daysRemaining = 0;
  let isPayDayToday = false;

  if (currentDay === clampedPayDay) {
    isPayDayToday = true;
    daysRemaining = 1;
    nextPayDate = new Date(currentYear, currentMonth, clampedPayDay);
  } else if (currentDay < clampedPayDay) {
    // La paie arrive plus tard dans le mois en cours
    daysRemaining = clampedPayDay - currentDay;
    nextPayDate = new Date(currentYear, currentMonth, clampedPayDay);
  } else {
    // La paie de ce mois est déjà passée, la prochaine est le mois prochain
    const daysInNextMonth = new Date(currentYear, currentMonth + 2, 0).getDate();
    const clampedNextPayDay = Math.min(Math.max(1, targetPayDay), daysInNextMonth);
    const daysLeftThisMonth = daysInCurrentMonth - currentDay;
    daysRemaining = daysLeftThisMonth + clampedNextPayDay;
    nextPayDate = new Date(currentYear, currentMonth + 1, clampedNextPayDay);
  }

  daysRemaining = Math.max(1, daysRemaining);

  // Le reste avant les dépenses d'aujourd'hui
  const startOfDayRemaining = remainingAmount + todayExpenses;

  // Budget alloué pour aujourd'hui (ou montant journalier si pas de dépenses aujourd'hui)
  const dailyBudget = startOfDayRemaining > 0 
    ? Math.floor(startOfDayRemaining / daysRemaining) 
    : (remainingAmount > 0 ? Math.floor(remainingAmount / daysRemaining) : 0);

  // DÉDUCTION AUTOMATIQUE DU BUDGET JOURNALIER AUJOURD'HUI
  const todaySpent = Math.max(0, todayExpenses);
  const todayRemaining = dailyBudget - todaySpent;
  const isOverDailyBudget = todayRemaining < 0;
  const dailyProgressPercent = dailyBudget > 0 
    ? Math.min(100, Math.round((todaySpent / dailyBudget) * 100)) 
    : (todaySpent > 0 ? 100 : 0);

  // Moyenne pour les jours restants après aujourd'hui
  const futureDailyBudget = (daysRemaining > 1 && remainingAmount > 0)
    ? Math.floor(remainingAmount / (daysRemaining - 1))
    : dailyBudget;

  // Détermination du statut et du conseil
  let status: "healthy" | "warning" | "critical" = "healthy";
  let advice = "";

  if (remainingAmount <= 0) {
    status = "critical";
    advice = "Attention ! Votre reste à vivre est épuisé. Évitez toute dépense non essentielle.";
  } else if (isOverDailyBudget) {
    status = "warning";
    advice = `Vigilance : vous avez dépassé votre budget journalier de ${Math.abs(todayRemaining).toLocaleString("fr-FR")} ${currency} aujourd'hui. Vos dépenses des prochains jours s'ajustent automatiquement.`;
  } else if (todaySpent > 0) {
    status = dailyProgressPercent > 80 ? "warning" : "healthy";
    advice = `Il vous reste ${todayRemaining.toLocaleString("fr-FR")} ${currency} disponible pour aujourd'hui (déduit automatiquement de vos dépenses du jour).`;
  } else {
    const percentRemaining = totalIncome > 0 ? (remainingAmount / totalIncome) * 100 : 50;
    if (percentRemaining < 15 || dailyBudget < 1500) {
      status = "warning";
      advice = `Rythme serré : limitez vos dépenses à ${dailyBudget.toLocaleString("fr-FR")} ${currency}/jour pour tenir jusqu'à la paie.`;
    } else {
      status = "healthy";
      advice = `Allure excellente : vous pouvez dépenser jusqu'à ${dailyBudget.toLocaleString("fr-FR")} ${currency} aujourd'hui en toute sérénité.`;
    }
  }

  return {
    dailyBudget,
    todaySpent,
    todayRemaining,
    isOverDailyBudget,
    dailyProgressPercent,
    futureDailyBudget,
    daysRemaining,
    nextPayDate,
    isPayDayToday,
    status,
    advice,
  };
}

/**
 * Formate un montant dans la devise choisie
 */
export function formatMoney(amount: number, currency: string = "FCFA", locale: string = "fr-FR"): string {
  const safeCurrency = currency && currency.trim() ? currency.trim() : "FCFA";
  const formatted = Math.round(amount || 0).toLocaleString(locale);
  if (safeCurrency === "EUR") return `${formatted} €`;
  if (safeCurrency === "USD") return `${formatted} $`;
  return `${formatted} ${safeCurrency}`;
}

/**
 * Formate un nombre avec séparateurs de milliers pour la saisie (ex: "50 000")
 */
export function formatThousands(val: number | string | null | undefined): string {
  if (val === "" || val === undefined || val === null) return "";
  const clean = val.toString().replace(/[^0-9]/g, "");
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Extrait la valeur numérique entière d une chaîne formatée (ex: "50 000" -> 50000)
 */
export function parseThousands(val: string | number | null | undefined): number {
  if (typeof val === "number") return Math.max(0, Math.round(val));
  if (!val) return 0;
  const clean = val.toString().replace(/[^0-9]/g, "");
  return clean ? parseInt(clean, 10) : 0;
}

/**
 * Déduplique les catégories par nom (insensible à la casse)
 * et préserve les montants alloués si un doublon avait déjà une allocation
 */
export function deduplicateCategories<T extends { name: string; amount?: number; allocation_id?: string }>(cats: T[]): T[] {
  if (!cats || !Array.isArray(cats)) return [];
  const seen = new Map<string, T>();
  for (const cat of cats) {
    if (!cat || !cat.name) continue;
    const key = cat.name.trim().toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, { ...cat, name: cat.name.trim() });
    } else {
      const existing = seen.get(key)!;
      if ((!existing.amount || existing.amount === 0) && (cat.amount && cat.amount > 0)) {
        existing.amount = cat.amount;
      }
      if (!existing.allocation_id && cat.allocation_id) {
        existing.allocation_id = cat.allocation_id;
      }
    }
  }
  return Array.from(seen.values());
}

/**
 * Calcule le total de l'épargne versée durant un mois spécifique
 */
export function getMonthlySavingsContributions(
  savingsGoals: { contributions?: { amount: number; date?: string }[] }[],
  year: number,
  month: number
): number {
  if (!savingsGoals || !Array.isArray(savingsGoals)) return 0;
  let total = 0;
  for (const goal of savingsGoals) {
    for (const c of (goal.contributions || [])) {
      if (!c.date) continue;
      const parts = c.date.split("-");
      if (parts.length >= 2) {
        const cYear = parseInt(parts[0], 10);
        const cMonth = parseInt(parts[1], 10);
        if (cYear === year && cMonth === month) {
          total += Number(c.amount) || 0;
        }
      }
    }
  }
  return total;
}

/**
 * Calcule les dépenses enregistrées pour aujourd'hui
 */
export function getTodayExpenses(
  transactions: TransactionItem[],
  todayDateStr?: string
): number {
  const targetDate = todayDateStr || new Date().toISOString().split("T")[0];
  return transactions
    .filter((tx) => isExpenseTransaction(tx) && !isSavingsTransaction(tx) && tx.date === targetDate)
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
}

/**
 * ============================================================================
 * B. RÉFÉRENTIEL DES SOURCES DE REVENUS
 * ============================================================================
 */
export const INCOME_SOURCES = [
  "Salaire",
  "Commerce",
  "Activités secondaires",
  "Prestations de services",
  "Loyers",
  "Autres revenus",
] as const;

export type IncomeSourceType = (typeof INCOME_SOURCES)[number];

/**
 * ============================================================================
 * C. CATÉGORIES DE DÉPENSES ADAPTÉES À LA RÉALITÉ AFRICAINE
 * ============================================================================
 */
export const AFRICAN_EXPENSE_CATEGORIES = [
  { name: "Alimentation", amount: 60000, color: "bg-emerald-500" },
  { name: "Loyer", amount: 80000, color: "bg-blue-500" },
  { name: "Transport", amount: 30000, color: "bg-amber-500" },
  { name: "Santé", amount: 15000, color: "bg-rose-500" },
  { name: "Scolarité", amount: 35000, color: "bg-indigo-500" },
  { name: "Électricité et eau", amount: 25000, color: "bg-cyan-500" },
  { name: "Communication et Internet", amount: 15000, color: "bg-sky-500" },
  { name: "Famille et solidarité", amount: 25000, color: "bg-purple-500" },
  { name: "Dîmes et offrandes", amount: 30000, color: "bg-teal-500" },
  { name: "Loisirs", amount: 15000, color: "bg-pink-500" },
  { name: "Autres dépenses", amount: 15000, color: "bg-slate-500" },
] as const;

/**
 * ============================================================================
 * D. MODÈLES D'OBJECTIFS D'ÉPARGNE CONCRETS
 * ============================================================================
 */
export const SAVINGS_GOAL_TEMPLATES = [
  { name: "Acheter une moto", suggestedTarget: 650000, color: "bg-blue-600" },
  { name: "Construire une maison", suggestedTarget: 5000000, color: "bg-emerald-600" },
  { name: "Préparer les frais de scolarité", suggestedTarget: 350000, color: "bg-purple-600" },
  { name: "Constituer un fonds d'urgence", suggestedTarget: 500000, color: "bg-amber-600" },
  { name: "Préparer un voyage", suggestedTarget: 400000, color: "bg-cyan-600" },
] as const;

/**
 * ============================================================================
 * E. GESTION DES DETTES & CRÉANCES
 * ============================================================================
 */
export interface DebtPaymentItem {
  id: string;
  amount: number;
  date: string;
  notes?: string;
  linkedTransactionId?: string;
}

export interface DebtItem {
  id: string;
  type: "payable" | "receivable"; // payable = dette à rembourser | receivable = dette à récupérer (créance)
  personName: string;
  phone?: string;
  totalAmount: number;
  remainingAmount: number;
  dueDate?: string;
  status: "pending" | "partial" | "paid";
  notes?: string;
  payments: DebtPaymentItem[];
  createdAt?: string;
}

export interface DebtAlertItem {
  debt: DebtItem;
  daysUntilDue: number; // négatif si en retard, 0 si aujourd'hui, positif si à venir
  urgency: "overdue" | "today" | "soon";
  message: string;
}

/**
 * Total des dettes restant à rembourser par l'utilisateur ("Personnes auxquelles je dois")
 */
export function getTotalPayableDebts(debts: DebtItem[]): number {
  if (!debts || !Array.isArray(debts)) return 0;
  return debts
    .filter((d) => d.type === "payable" && d.status !== "paid" && d.remainingAmount > 0)
    .reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
}

/**
 * Total des créances restant à récupérer par l'utilisateur ("Personnes qui me doivent")
 */
export function getTotalReceivableDebts(debts: DebtItem[]): number {
  if (!debts || !Array.isArray(debts)) return 0;
  return debts
    .filter((d) => d.type === "receivable" && d.status !== "paid" && d.remainingAmount > 0)
    .reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
}

/**
 * Détecte les dettes et créances arrivant à échéance ou en retard
 */
export function getDebtAlerts(
  debts: DebtItem[],
  currentDate: Date = new Date(),
  warningDays: number = 7,
  currency: string = "FCFA"
): DebtAlertItem[] {
  if (!debts || !Array.isArray(debts)) return [];
  const todayMidnight = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  ).getTime();

  const alerts: DebtAlertItem[] = [];

  for (const debt of debts) {
    if (debt.status === "paid" || debt.remainingAmount <= 0 || !debt.dueDate) continue;
    const parts = debt.dueDate.split("-");
    if (parts.length < 3) continue;
    const dueMidnight = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    ).getTime();

    const diffDays = Math.round((dueMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
    const formattedRemaining = formatMoney(debt.remainingAmount, currency);

    if (diffDays < 0) {
      alerts.push({
        debt,
        daysUntilDue: diffDays,
        urgency: "overdue",
        message:
          debt.type === "payable"
            ? `Retard de ${Math.abs(diffDays)} j : Vous devez ${formattedRemaining} à ${debt.personName}.`
            : `Retard de ${Math.abs(diffDays)} j : ${debt.personName} vous doit ${formattedRemaining}. Pensez à relancer.`,
      });
    } else if (diffDays === 0) {
      alerts.push({
        debt,
        daysUntilDue: 0,
        urgency: "today",
        message:
          debt.type === "payable"
            ? `Échéance aujourd'hui : Remboursement de ${formattedRemaining} à ${debt.personName}.`
            : `Échéance aujourd'hui : ${debt.personName} doit vous rembourser ${formattedRemaining}.`,
      });
    } else if (diffDays <= warningDays) {
      alerts.push({
        debt,
        daysUntilDue: diffDays,
        urgency: "soon",
        message:
          debt.type === "payable"
            ? `Dans ${diffDays} j : Échéance de ${formattedRemaining} envers ${debt.personName}.`
            : `Dans ${diffDays} j : ${debt.personName} doit vous verser ${formattedRemaining}.`,
      });
    }
  }

  return alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/**
 * ============================================================================
 * F. MOTEUR D'INTELLIGENCE ARTIFICIELLE FINANCIÈRE (CONSEILLER MULTI-PAGES)
 * ============================================================================
 */
export interface AIFinding {
  id: string;
  severity: "critical" | "warning" | "positive" | "info";
  sourcePages: string[]; // ex: ["Mon Budget", "Épargne", "Transactions"]
  title: string;
  detail: string;
  impactAmount?: number;
}

export interface AIRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  category: "budget" | "savings" | "debt" | "income" | "solidarity";
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  correctiveActionType?:
    | "align_overbudget"
    | "fit_envelopes_to_balance"
    | "sync_unplanned_savings"
    | "create_emergency_fund";
  correctivePayload?: {
    categoryName?: string;
    targetAmount?: number;
  };
}

export interface TemporalFinancialMetrics {
  dayOfMonth: number;
  daysInMonth: number;
  monthElapsedPercent: number;
  daysUntilPayDay: number;
  totalOutflows: number;
  outflowPercentOfIncome: number;
  dailySurvivalQuota: number;
  reservedInUnspentEnvelopes: number;
  freeMarginAfterEnvelopes: number;
  unplannedOrExceededTotal: number;
  burnRateStatus: "critical" | "warning" | "healthy";
}

export interface FinancialAIAnalysis {
  healthScore: number; // 0 - 100
  healthLabel: "Excellente" | "Bonne" | "À surveiller" | "Critique";
  summary: string;
  findings: AIFinding[];
  recommendations: AIRecommendation[];
  temporal: TemporalFinancialMetrics;
  breakdown: {
    essentialsPercent: number;
    solidarityAndTithePercent: number;
    leisurePercent: number;
    savingsPercent: number;
    debtRatioPercent: number;
  };
}

export function generateFinancialAIAnalysis({
  income,
  incomeSourcesCount = 1,
  categories,
  transactions,
  savingsGoals,
  debts,
  monthlySavings = 0,
  currency = "FCFA",
  currentDate = new Date(),
  payDay = 28,
}: {
  income: number;
  incomeSourcesCount?: number;
  categories: CategoryItem[];
  transactions: TransactionItem[];
  savingsGoals: { name: string; target: number; current: number; status?: string }[];
  debts: DebtItem[];
  monthlySavings?: number;
  currency?: string;
  currentDate?: Date;
  payDay?: number;
}): FinancialAIAnalysis {
  const txSavings = getSpentByCategory(transactions, "Épargne", monthlySavings);
  const effectiveMonthlySavings = Math.max(monthlySavings, txSavings);
  const totalExpenses = getTotalExpenses(transactions, effectiveMonthlySavings);
  const remaining = getRemainingToLive(income, totalExpenses);
  const payableDebts = getTotalPayableDebts(debts);
  const receivableDebts = getTotalReceivableDebts(debts);
  const debtAlerts = getDebtAlerts(debts, currentDate, 7, currency);
  const overBudgetCats = getOverBudgetCategories(categories, transactions, 80);

  // 1. Métriques temporelles (Jour du mois vs Rythme de sortie d'argent)
  const dayOfMonth = currentDate.getDate();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const monthElapsedPercent = Math.max(1, Math.round((dayOfMonth / daysInMonth) * 100));

  const dailyInfo = getDailyBudget({
    remainingAmount: remaining,
    totalIncome: income,
    targetPayDay: payDay,
    currentDate,
    currency,
  });
  const daysUntilPayDay = Math.max(1, dailyInfo.daysRemaining);
  const dailySurvivalQuota = remaining > 0 ? Math.floor(remaining / daysUntilPayDay) : 0;

  const totalOutflows = totalExpenses + effectiveMonthlySavings;
  const outflowPercentOfIncome = income > 0 ? Math.round((totalOutflows / income) * 100) : 0;

  // Calcul des enveloppes restantes à consommer (hors Épargne déjà déduite)
  let reservedInUnspentEnvelopes = 0;
  let unplannedOrExceededTotal = 0;
  const exceededCategoriesList: { name: string; budgeted: number; spent: number; excess: number }[] = [];
  const handledCatNames = new Set<string>();

  for (const cat of categories) {
    const norm = cat.name.trim().toLowerCase();
    handledCatNames.add(norm);
    const budgeted = Math.max(0, Number(cat.amount) || 0);
    const spent = getSpentByCategory(transactions, cat.name, effectiveMonthlySavings);

    if (norm !== "épargne" && norm !== "epargne") {
      if (budgeted > spent) {
        reservedInUnspentEnvelopes += budgeted - spent;
      } else if (spent > budgeted) {
        const excess = spent - budgeted;
        unplannedOrExceededTotal += excess;
        exceededCategoriesList.push({
          name: cat.name,
          budgeted,
          spent,
          excess,
        });
      }
    }
  }

  // Détecter les dépenses faites sur des catégories absentes de Mon Budget
  for (const tx of transactions) {
    if (!isExpenseTransaction(tx) || isSavingsTransaction(tx)) continue;
    const catName = (tx.category || "Autre (Hors Budget)").trim();
    const norm = catName.toLowerCase();
    if (!handledCatNames.has(norm)) {
      const amt = Number(tx.amount) || 0;
      unplannedOrExceededTotal += amt;
      const existing = exceededCategoriesList.find((e) => e.name.toLowerCase() === norm);
      if (existing) {
        existing.spent += amt;
        existing.excess += amt;
      } else {
        exceededCategoriesList.push({
          name: catName,
          budgeted: 0,
          spent: amt,
          excess: amt,
        });
      }
    }
  }

  const freeMarginAfterEnvelopes = remaining - reservedInUnspentEnvelopes;

  // Déterminer le statut du rythme de consommation (Burn Rate)
  let burnRateStatus: "critical" | "warning" | "healthy" = "healthy";
  if (
    remaining <= 0 ||
    (income > 0 && dayOfMonth <= 10 && outflowPercentOfIncome >= 75) ||
    (income > 0 && remaining / income < 0.18 && daysUntilPayDay >= 15)
  ) {
    burnRateStatus = "critical";
  } else if (
    (income > 0 && outflowPercentOfIncome > monthElapsedPercent + 30) ||
    freeMarginAfterEnvelopes < 0
  ) {
    burnRateStatus = "warning";
  }

  // Calcul des grandes masses de dépenses (Réalité africaine)
  const essentialNames = [
    "alimentation",
    "loyer",
    "logement & loyer",
    "transport",
    "transport & carburant",
    "déplacement",
    "santé",
    "santé & pharmacie",
    "scolarité",
    "besoin enfants",
    "électricité et eau",
    "factures (eau, électricité, canal+)",
    "communication et internet",
  ];
  const solidarityNames = ["famille et solidarité", "dîmes et offrandes"];
  const leisureNames = ["loisirs", "loisirs & sorties"];

  let essentialsSpent = 0;
  let solidaritySpent = 0;
  let leisureSpent = 0;

  for (const tx of transactions) {
    if (!isExpenseTransaction(tx) || isSavingsTransaction(tx)) continue;
    const catNorm = (tx.category || "").trim().toLowerCase();
    const amt = Number(tx.amount) || 0;
    if (essentialNames.includes(catNorm)) {
      essentialsSpent += amt;
    } else if (solidarityNames.includes(catNorm)) {
      solidaritySpent += amt;
    } else if (leisureNames.includes(catNorm)) {
      leisureSpent += amt;
    } else {
      essentialsSpent += amt * 0.5;
    }
  }

  const essentialsPercent = income > 0 ? Math.round((essentialsSpent / income) * 100) : 0;
  const solidarityAndTithePercent = income > 0 ? Math.round((solidaritySpent / income) * 100) : 0;
  const leisurePercent = income > 0 ? Math.round((leisureSpent / income) * 100) : 0;
  const savingsPercent = income > 0 ? Math.round((effectiveMonthlySavings / income) * 100) : 0;
  const debtRatioPercent = income > 0 ? Math.round((payableDebts / income) * 100) : payableDebts > 0 ? 100 : 0;

  // Calcul du Score de Santé Financière sur 100 (tenant compte de la réalité temporelle !)
  let score = 70;
  if (income <= 0) {
    score = 40;
  } else {
    // 1. Solde disponible et rythme temporel
    if (remaining < 0) {
      score -= 30;
    } else if (burnRateStatus === "critical") {
      score -= 18;
    } else if (burnRateStatus === "warning") {
      score -= 8;
    } else if (remaining / income >= 0.25) {
      score += 10;
    }

    // 2. Couverture des enveloppes restantes par le solde réel
    if (freeMarginAfterEnvelopes < 0) {
      score -= 10;
    }

    // 3. Épargne (valorisée mais équilibrée avec le reste à vivre)
    if (savingsPercent >= 15 && remaining >= income * 0.2) score += 12;
    else if (savingsPercent >= 15 && remaining < income * 0.2) score += 4;
    else if (savingsPercent >= 5) score += 6;
    else if (savingsGoals.length === 0) score -= 8;

    // 4. Endettement
    if (debtRatioPercent > 50) score -= 20;
    else if (debtRatioPercent > 25) score -= 10;
    else if (payableDebts === 0) score += 8;

    // 5. Respect des enveloppes & dépenses non prévues
    const strictlyOver = overBudgetCats.filter((c) => c.isOverBudget);
    score -= strictlyOver.length * 5;

    // 6. Diversification des revenus
    if (incomeSourcesCount >= 2) score += 5;
  }

  const healthScore = Math.max(10, Math.min(100, Math.round(score)));
  const healthLabel: FinancialAIAnalysis["healthLabel"] =
    healthScore >= 80
      ? "Excellente"
      : healthScore >= 60
      ? "Bonne"
      : healthScore >= 40
      ? "À surveiller"
      : "Critique";

  // ==========================================================================
  // CONSTATS MULTI-PAGES (FINDINGS) BASÉS SUR LA RÉALITÉ IMMÉDIATE
  // ==========================================================================
  const findings: AIFinding[] = [];

  // Constat A : Diagnostic temporel (ex: Jour 4 du mois et il ne reste que 93 000 F)
  if (income > 0) {
    if (burnRateStatus === "critical" || burnRateStatus === "warning") {
      findings.push({
        id: "finding-burn-rate",
        severity: burnRateStatus === "critical" ? "critical" : "warning",
        sourcePages: ["Tableau de bord", "Mon Budget", "Transactions"],
        title: `Jour ${dayOfMonth} du mois : ${outflowPercentOfIncome}% de vos revenus déjà sortis`,
        detail: `Nous sommes seulement le ${dayOfMonth} du mois (${monthElapsedPercent}% du mois écoulé) et vous avez déjà engagé ${formatMoney(totalOutflows, currency)} sur ${formatMoney(income, currency)}. Il vous reste ${formatMoney(remaining, currency)} en caisse pour tenir ${daysUntilPayDay} jours jusqu'à la paie (soit un plafond strict de ${formatMoney(dailySurvivalQuota, currency)}/jour).`,
        impactAmount: remaining,
      });
    } else {
      findings.push({
        id: "finding-burn-rate-ok",
        severity: "positive",
        sourcePages: ["Tableau de bord", "Mon Budget"],
        title: `Jour ${dayOfMonth} du mois : rythme de trésorerie maîtrisé`,
        detail: `Avec ${formatMoney(remaining, currency)} disponibles pour les ${daysUntilPayDay} prochains jours, vous disposez d'une marge quotidienne de ${formatMoney(dailySurvivalQuota, currency)}/jour.`,
        impactAmount: remaining,
      });
    }
  }

  // Constat B : Analyse de l'Épargne ajoutée vs Reste à vivre
  if (effectiveMonthlySavings > 0 && income > 0) {
    if (savingsPercent >= 25 && remaining < income * 0.25) {
      findings.push({
        id: "finding-heavy-early-savings",
        severity: "warning",
        sourcePages: ["Épargne", "Mon Budget"],
        title: `Fort prélèvement d'épargne (${formatMoney(effectiveMonthlySavings, currency)}, soit ${savingsPercent}% du revenu)`,
        detail: `Cette épargne a été comptabilisée automatiquement dans Mon Budget. C'est un effort remarquable pour vos objectifs, mais combiné à vos dépenses (${formatMoney(totalExpenses, currency)}), il réduit votre liquidité immédiate à ${formatMoney(remaining, currency)} dès le ${dayOfMonth} du mois.`,
        impactAmount: effectiveMonthlySavings,
      });
    } else {
      findings.push({
        id: "finding-savings-active",
        severity: "positive",
        sourcePages: ["Épargne", "Mon Budget"],
        title: `Épargne du mois (${formatMoney(effectiveMonthlySavings, currency)}) synchronisée au budget`,
        detail: `Vos versements d'épargne représentent ${savingsPercent}% de vos entrées du mois et sont bien déduits de votre solde restant.`,
        impactAmount: effectiveMonthlySavings,
      });
    }
  }

  // Constat C : Dépenses non prévues ou dépassements d'enveloppes (Loisirs, Remboursement dette, etc.)
  if (exceededCategoriesList.length > 0) {
    const detailsText = exceededCategoriesList
      .map((item) =>
        item.budgeted > 0
          ? `${item.name} (${formatMoney(item.spent, currency)} dépensés contre ${formatMoney(item.budgeted, currency)} prévus, soit +${formatMoney(item.excess, currency)})`
          : `${item.name} (${formatMoney(item.spent, currency)} ajoutés sans budget initial)`
      )
      .join(" ; ");

    findings.push({
      id: "finding-unplanned-expenses",
      severity: "critical",
      sourcePages: ["Transactions", "Mon Budget", "Dettes & Créances"],
      title: `${exceededCategoriesList.length} poste(s) avec dépenses non prévues ou en dépassement (+${formatMoney(unplannedOrExceededTotal, currency)})`,
      detail: `Sorties au-dessus des prévisions initiales : ${detailsText}. Cet écart de ${formatMoney(unplannedOrExceededTotal, currency)} a directement diminué votre solde restant.`,
      impactAmount: unplannedOrExceededTotal,
    });
  }

  // Constat D : Confrontation entre le Solde réel restant (ex: 93 000 F) et les Enveloppes restantes à dépenser (ex: 85 000 F)
  if (income > 0 && reservedInUnspentEnvelopes > 0) {
    if (freeMarginAfterEnvelopes < 0) {
      findings.push({
        id: "finding-envelopes-exceed-cash",
        severity: "critical",
        sourcePages: ["Mon Budget", "Tableau de bord"],
        title: `Vos enveloppes restantes (${formatMoney(reservedInUnspentEnvelopes, currency)}) dépassent votre solde réel (${formatMoney(remaining, currency)})`,
        detail: `Attention : il vous reste ${formatMoney(remaining, currency)} en caisse, mais vos enveloppes non encore dépensées prévoient encore ${formatMoney(reservedInUnspentEnvelopes, currency)} de sorties. Il manque ${formatMoney(Math.abs(freeMarginAfterEnvelopes), currency)} pour tout couvrir !`,
        impactAmount: Math.abs(freeMarginAfterEnvelopes),
      });
    } else if (freeMarginAfterEnvelopes <= income * 0.08) {
      findings.push({
        id: "finding-tight-free-margin",
        severity: "warning",
        sourcePages: ["Mon Budget"],
        title: `Marge libre très serrée (${formatMoney(freeMarginAfterEnvelopes, currency)}) après vos enveloppes prévues`,
        detail: `Sur vos ${formatMoney(remaining, currency)} en caisse, ${formatMoney(reservedInUnspentEnvelopes, currency)} sont déjà réservés dans vos enveloppes non consommées (Santé, Déplacement, Besoin enfants, etc.). Il ne vous reste que ${formatMoney(freeMarginAfterEnvelopes, currency)} de marge pour les imprévus du mois.`,
        impactAmount: freeMarginAfterEnvelopes,
      });
    }
  }

  // ==========================================================================
  // RECOMMANDATIONS & ACTIONS CORRECTRICES CONCRÈTES
  // ==========================================================================
  const recommendations: AIRecommendation[] = [];

  // Recommandation Prioritaire 1 : Si le solde restant ne suffit plus à couvrir les enveloppes restantes
  if (income > 0 && freeMarginAfterEnvelopes < 0) {
    recommendations.push({
      id: "action-fit-envelopes-to-balance",
      priority: "high",
      category: "budget",
      title: `Action correctrice : Réduire vos enveloppes restantes de ${formatMoney(Math.abs(freeMarginAfterEnvelopes), currency)}`,
      description: `Votre caisse réelle (${formatMoney(remaining, currency)}) ne peut plus financer les ${formatMoney(reservedInUnspentEnvelopes, currency)} prévus dans vos enveloppes non consommées. Ajustez-les proportionnellement à votre solde réel en 1 clic pour éviter le découvert.`,
      actionLabel: "Ajuster mes enveloppes au solde réel",
      actionHref: "/budget",
      correctiveActionType: "fit_envelopes_to_balance",
    });
  }

  // Recommandation Prioritaire 2 : Alerte Rythme de début de mois (ex: le 4 du mois avec 93 000 F)
  if (income > 0 && (burnRateStatus === "critical" || burnRateStatus === "warning")) {
    recommendations.push({
      id: "action-survival-pacing",
      priority: "high",
      category: "budget",
      title: `Plan de maîtrise sur ${daysUntilPayDay} jours : plafonnez vos dépenses à ${formatMoney(dailySurvivalQuota, currency)}/jour`,
      description: `Au jour ${dayOfMonth} du mois, il vous reste ${formatMoney(remaining, currency)}. Pour ne pas tomber à sec avant le ${payDay}, bloquez toute dépense de loisirs ou non urgente et respectez strictement le quota de ${formatMoney(dailySurvivalQuota, currency)} par jour.`,
      actionLabel: "Piloter mes transactions",
      actionHref: "/transactions",
    });
  }

  // Recommandation Prioritaire 3 : Dépenses non prévues ou dépassements (Loisirs, Dette, etc.)
  if (exceededCategoriesList.length > 0) {
    const worst = exceededCategoriesList.sort((a, b) => b.excess - a.excess)[0];
    recommendations.push({
      id: "category-overbudget",
      priority: "high",
      category: "budget",
      title: `Régulariser l'écart sur « ${worst.name} » (+${formatMoney(worst.excess, currency)} hors prévision)`,
      description:
        worst.budgeted > 0
          ? `Vous avez dépensé ${formatMoney(worst.spent, currency)} sur « ${worst.name} » pour ${formatMoney(worst.budgeted, currency)} prévus. Mettez à jour le plafond de cette enveloppe et bloquez toute nouvelle sortie sur ce poste ce mois-ci.`
          : `Vous avez engagé ${formatMoney(worst.spent, currency)} sur « ${worst.name} » sans enveloppe prévue au départ. Officialisez ce poste dans votre budget pour garder vos comptes justes.`,
      actionLabel: `Aligner l'enveloppe ${worst.name}`,
      actionHref: "/budget",
      correctiveActionType: "align_overbudget",
      correctivePayload: {
        categoryName: worst.name,
        targetAmount: worst.spent,
      },
    });
  } else if (overBudgetCats.length > 0) {
    const worst = overBudgetCats[0];
    recommendations.push({
      id: "category-warning",
      priority: "medium",
      category: "budget",
      title: `Enveloppe "${worst.name}" sous tension (${worst.percent}%)`,
      description: `Vous avez déjà consommé ${worst.percent}% du budget "${worst.name}". Ralentissez sur ce poste pour finir le mois sereinement.`,
      actionLabel: "Voir les enveloppes",
      actionHref: "/budget",
    });
  }

  // Recommandation 4 : Conseil sur l'épargne déjà élevée en début de mois
  if (effectiveMonthlySavings > 0 && savingsPercent >= 25 && remaining < income * 0.25) {
    recommendations.push({
      id: "savings-pause-advice",
      priority: "medium",
      category: "savings",
      title: `Suspendez les nouveaux versements d'épargne pour le reste du mois`,
      description: `Avec ${formatMoney(effectiveMonthlySavings, currency)} déjà épargnés (${savingsPercent}% de vos revenus), votre objectif mensuel d'épargne est largement atteint. Conservez vos ${formatMoney(remaining, currency)} restants en liquidité disponible pour les besoins courants du mois.`,
      actionLabel: "Voir mon épargne",
      actionHref: "/savings",
    });
  }

  // Recommandation 5 : Alertes dettes urgentes & Créances à recouvrer pour renflouer la caisse !
  const overduePayables = debtAlerts.filter((a) => a.debt.type === "payable" && a.urgency === "overdue");
  const overdueReceivables = debtAlerts.filter((a) => a.debt.type === "receivable" && a.urgency === "overdue");

  if (receivableDebts > 0 && remaining < income * 0.3) {
    recommendations.push({
      id: "debt-recover-cashboost",
      priority: "high",
      category: "debt",
      title: `Relancez vos créances (${formatMoney(receivableDebts, currency)}) pour remonter votre solde`,
      description: `Votre solde restant est de ${formatMoney(remaining, currency)} alors qu'on vous doit ${formatMoney(receivableDebts, currency)}. Encaisser même une partie de vos créances augmentera immédiatement votre budget disponible.`,
      actionLabel: "Recouvrer mes créances",
      actionHref: "/debts",
    });
  } else if (overdueReceivables.length > 0) {
    recommendations.push({
      id: "debt-overdue-receivable",
      priority: "high",
      category: "debt",
      title: `Créances en retard à récupérer (${formatMoney(receivableDebts, currency)})`,
      description: `${overdueReceivables[0].message} Relancer vos débiteurs augmentera immédiatement votre trésorerie disponible.`,
      actionLabel: "Voir les créances",
      actionHref: "/debts",
    });
  }

  if (overduePayables.length > 0) {
    recommendations.push({
      id: "debt-overdue-payable",
      priority: "high",
      category: "debt",
      title: `${overduePayables.length} dette(s) à rembourser en retard`,
      description: `${overduePayables[0].message} Priorisez un remboursement partiel ou total pour préserver votre crédibilité financière.`,
      actionLabel: "Gérer mes dettes",
      actionHref: "/debts",
    });
  }

  // Recommandation 6 : Solidarité & Dîmes
  if (income > 0 && solidarityAndTithePercent > 25) {
    recommendations.push({
      id: "solidarity-balance",
      priority: "medium",
      category: "solidarity",
      title: `Poids élevé de Solidarité & Dîmes (${solidarityAndTithePercent}% du revenu)`,
      description: `Votre générosité est admirable (${formatMoney(solidaritySpent, currency)}), mais elle dépasse 25% de vos revenus. Fixez une enveloppe mensuelle dédiée aux imprévus familiaux pour protéger votre solde.`,
      actionLabel: "Plafonner l'enveloppe",
      actionHref: "/budget",
    });
  }

  // Recommandation 7 : Épargne & Fonds d'urgence
  const hasEmergencyFund = savingsGoals.some(
    (g) => g.name.toLowerCase().includes("urgence") || g.name.toLowerCase().includes("sécurité")
  );
  if (!hasEmergencyFund) {
    recommendations.push({
      id: "savings-emergency",
      priority: "medium",
      category: "savings",
      title: "Constituez un Fonds d'urgence",
      description:
        "En Afrique, les imprévus (santé, famille, pannes) sont fréquents. Créez un objectif « Constituer un fonds d'urgence » équivalent à 3 mois de dépenses vitales.",
      actionLabel: "Créer ce fonds",
      actionHref: "/savings",
      correctiveActionType: "create_emergency_fund",
    });
  } else if (income > 0 && savingsPercent < 10 && remaining > income * 0.25) {
    const suggestedSaving = Math.max(5000, Math.round((income * 0.1 - effectiveMonthlySavings) / 1000) * 1000);
    recommendations.push({
      id: "savings-boost",
      priority: "medium",
      category: "savings",
      title: `Augmentez votre taux d'épargne (${savingsPercent}% actuellement)`,
      description: `Il vous reste ${formatMoney(remaining, currency)} disponibles ce mois-ci. Mettez de côté au moins ${formatMoney(Math.min(suggestedSaving, remaining), currency)} vers vos projets.`,
      actionLabel: "Épargner maintenant",
      actionHref: "/savings",
    });
  }

  // Recommandation 8 : Diversification des revenus
  if (incomeSourcesCount <= 1 && income > 0) {
    recommendations.push({
      id: "income-diversification",
      priority: "low",
      category: "income",
      title: "Développez une seconde source de revenus",
      description:
        "Dépendre d'une seule entrée vous expose aux imprévus. Pensez à déclarer ou lancer une activité secondaire (commerce, prestation de services, loyers) pour accélérer vos projets.",
      actionLabel: "Gérer mes revenus",
      actionHref: "/budget",
    });
  }

  // Recommandation 9 : Ratio d'endettement
  if (payableDebts > 0 && overduePayables.length === 0) {
    recommendations.push({
      id: "debt-repayment-plan",
      priority: debtRatioPercent > 35 ? "high" : "low",
      category: "debt",
      title: `Plan d'apurement des dettes (${formatMoney(payableDebts, currency)})`,
      description: `Vos dettes représentent ${debtRatioPercent}% de vos revenus mensuels. Affectez au moins 15% de votre solde disponible chaque mois pour réduire ce passif.`,
      actionLabel: "Suivre mes remboursements",
      actionHref: "/debts",
    });
  }

  // Synthèse globale réaliste et incarnée
  let summary = "";
  if (income <= 0) {
    summary =
      "Commencez par renseigner vos sources de revenus du mois (Salaire, Commerce, Prestations...) pour activer le diagnostic complet de votre Conseiller IA.";
  } else if (burnRateStatus === "critical") {
    summary = `Alerte Trésorerie au jour ${dayOfMonth} du mois : vous avez déjà mobilisé ${outflowPercentOfIncome}% de vos entrées (${formatMoney(totalOutflows, currency)}, dont ${formatMoney(effectiveMonthlySavings, currency)} d'épargne). Il ne vous reste que ${formatMoney(remaining, currency)} pour tenir ${daysUntilPayDay} jours (max ${formatMoney(dailySurvivalQuota, currency)}/jour).`;
  } else if (exceededCategoriesList.length > 0) {
    summary = `Au jour ${dayOfMonth} du mois, votre solde réel est de ${formatMoney(remaining, currency)} (${formatMoney(dailySurvivalQuota, currency)}/jour sur ${daysUntilPayDay} j), mais ${exceededCategoriesList.length} poste(s) ont dépassé les prévisions initiales de ${formatMoney(unplannedOrExceededTotal, currency)}.`;
  } else if (healthScore >= 80) {
    summary = `Excellente maîtrise financière (${healthScore}/100) au jour ${dayOfMonth} du mois ! Votre solde réel est de ${formatMoney(remaining, currency)} (${formatMoney(dailySurvivalQuota, currency)}/jour disponibles).`;
  } else {
    summary = `Gestion globale à ${healthScore}/100 au jour ${dayOfMonth} du mois, avec un solde réel restant de ${formatMoney(remaining, currency)} pour ${daysUntilPayDay} jours (${formatMoney(dailySurvivalQuota, currency)}/jour).`;
  }

  return {
    healthScore,
    healthLabel,
    summary,
    findings,
    recommendations,
    temporal: {
      dayOfMonth,
      daysInMonth,
      monthElapsedPercent,
      daysUntilPayDay,
      totalOutflows,
      outflowPercentOfIncome,
      dailySurvivalQuota,
      reservedInUnspentEnvelopes,
      freeMarginAfterEnvelopes,
      unplannedOrExceededTotal,
      burnRateStatus,
    },
    breakdown: {
      essentialsPercent,
      solidarityAndTithePercent,
      leisurePercent,
      savingsPercent,
      debtRatioPercent,
    },
  };
}
