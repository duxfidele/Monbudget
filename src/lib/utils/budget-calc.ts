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

export function getTotalExpenses(transactions: TransactionItem[]): number {
  return transactions
    .filter((tx) => isExpenseTransaction(tx) && !isSavingsTransaction(tx))
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
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
 * Calcule le reste à vivre réel (Revenus - Dépenses - Épargne)
 */
export function getRemainingToLive(income: number, totalExpenses: number, totalSavings: number = 0): number {
  return income - totalExpenses - totalSavings;
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
 * F. MOTEUR D'INTELLIGENCE ARTIFICIELLE FINANCIÈRE
 * ============================================================================
 */
export interface AIRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  category: "budget" | "savings" | "debt" | "income" | "solidarity";
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface FinancialAIAnalysis {
  healthScore: number; // 0 - 100
  healthLabel: "Excellente" | "Bonne" | "À surveiller" | "Critique";
  summary: string;
  recommendations: AIRecommendation[];
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
}): FinancialAIAnalysis {
  const totalExpenses = getTotalExpenses(transactions);
  const remaining = getRemainingToLive(income, totalExpenses, monthlySavings);
  const payableDebts = getTotalPayableDebts(debts);
  const receivableDebts = getTotalReceivableDebts(debts);
  const debtAlerts = getDebtAlerts(debts, currentDate, 7, currency);
  const overBudgetCats = getOverBudgetCategories(categories, transactions, 80);

  // Calcul des grandes masses de dépenses (Réalité africaine)
  const essentialNames = [
    "alimentation",
    "loyer",
    "logement & loyer",
    "transport",
    "transport & carburant",
    "santé",
    "santé & pharmacie",
    "scolarité",
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
    if (!isExpenseTransaction(tx)) continue;
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
  const savingsPercent = income > 0 ? Math.round((monthlySavings / income) * 100) : 0;
  const debtRatioPercent = income > 0 ? Math.round((payableDebts / income) * 100) : payableDebts > 0 ? 100 : 0;

  // Calcul du Score de Santé Financière sur 100
  let score = 70;
  if (income <= 0) {
    score = 40;
  } else {
    // 1. Solde disponible
    if (remaining < 0) score -= 25;
    else if (remaining / income >= 0.15) score += 10;

    // 2. Épargne
    if (savingsPercent >= 15) score += 12;
    else if (savingsPercent >= 5) score += 5;
    else if (savingsGoals.length === 0) score -= 8;

    // 3. Endettement
    if (debtRatioPercent > 50) score -= 20;
    else if (debtRatioPercent > 25) score -= 10;
    else if (payableDebts === 0) score += 8;

    // 4. Respect des enveloppes
    const strictlyOver = overBudgetCats.filter((c) => c.isOverBudget);
    score -= strictlyOver.length * 5;

    // 5. Diversification des revenus
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

  const recommendations: AIRecommendation[] = [];

  // Recommandation 1 : Alertes dettes urgentes
  const overduePayables = debtAlerts.filter((a) => a.debt.type === "payable" && a.urgency === "overdue");
  const overdueReceivables = debtAlerts.filter((a) => a.debt.type === "receivable" && a.urgency === "overdue");

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

  if (overdueReceivables.length > 0) {
    recommendations.push({
      id: "debt-overdue-receivable",
      priority: "high",
      category: "debt",
      title: `Créances à récupérer (${formatMoney(receivableDebts, currency)})`,
      description: `${overdueReceivables[0].message} Relancer vos débiteurs augmentera immédiatement votre trésorerie disponible.`,
      actionLabel: "Voir les créances",
      actionHref: "/debts",
    });
  }

  // Recommandation 2 : Dépassement de budget ou déficit
  if (remaining < 0) {
    recommendations.push({
      id: "budget-deficit",
      priority: "high",
      category: "budget",
      title: "Alerte : Déficit mensuel détecté",
      description: `Vos sorties dépassent vos revenus de ${formatMoney(Math.abs(remaining), currency)}. Suspendez les dépenses non essentielles (Loisirs, Autres) jusqu'à la prochaine entrée.`,
      actionLabel: "Ajuster mon budget",
      actionHref: "/budget",
    });
  } else if (overBudgetCats.length > 0) {
    const worst = overBudgetCats[0];
    recommendations.push({
      id: "category-overbudget",
      priority: worst.isOverBudget ? "high" : "medium",
      category: "budget",
      title: `Enveloppe "${worst.name}" sous tension (${worst.percent}%)`,
      description: worst.isOverBudget
        ? `Vous avez dépassé le plafond de "${worst.name}" de ${formatMoney(Math.abs(worst.remaining), currency)}. Rééquilibrez avec une enveloppe moins consommée.`
        : `Vous avez déjà consommé ${worst.percent}% du budget "${worst.name}". Ralentissez sur ce poste pour finir le mois sereinement.`,
      actionLabel: "Voir les enveloppes",
      actionHref: "/budget",
    });
  }

  // Recommandation 3 : Solidarité & Dîmes
  if (income > 0 && solidarityAndTithePercent > 25) {
    recommendations.push({
      id: "solidarity-balance",
      priority: "medium",
      category: "solidarity",
      title: `Poids élevé de Solidarité & Dîmes (${solidarityAndTithePercent}% du revenu)`,
      description: `Votre générosité est admirable (${formatMoney(solidaritySpent, currency)}), mais elle dépasse 25% de vos revenus. Fixez une enveloppe mensuelle dédiée aux imprévus familiaux pour protéger votre épargne.`,
      actionLabel: "Plafonner l'enveloppe",
      actionHref: "/budget",
    });
  }

  // Recommandation 4 : Épargne & Fonds d'urgence
  const hasEmergencyFund = savingsGoals.some((g) =>
    g.name.toLowerCase().includes("urgence") || g.name.toLowerCase().includes("sécurité")
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
    });
  } else if (income > 0 && savingsPercent < 10 && remaining > 0) {
    const suggestedSaving = Math.max(5000, Math.round((income * 0.1 - monthlySavings) / 1000) * 1000);
    recommendations.push({
      id: "savings-boost",
      priority: "medium",
      category: "savings",
      title: `Augmentez votre taux d'épargne (${savingsPercent}% actuellement)`,
      description: `Il vous reste ${formatMoney(remaining, currency)} disponibles ce mois-ci. Mettez de côté au moins ${formatMoney(Math.min(suggestedSaving, remaining), currency)} vers vos projets (moto, maison, scolarité).`,
      actionLabel: "Épargner maintenant",
      actionHref: "/savings",
    });
  }

  // Recommandation 5 : Diversification des revenus
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

  // Recommandation 6 : Ratio d'endettement
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

  // Synthèse globale
  let summary = "";
  if (income <= 0) {
    summary =
      "Commencez par renseigner vos sources de revenus du mois (Salaire, Commerce, Prestations...) pour activer le diagnostic IA complet.";
  } else if (healthScore >= 80) {
    summary = `Excellente maîtrise financière (${healthScore}/100) ! Votre solde est positif (${formatMoney(remaining, currency)}) et vos charges sont bien contenues.`;
  } else if (healthScore >= 60) {
    summary = `Bonne gestion globale (${healthScore}/100), avec un solde disponible de ${formatMoney(remaining, currency)}. Suivez les recommandations ci-dessous pour renforcer votre épargne.`;
  } else {
    summary = `Votre équilibre financier demande de la vigilance (${healthScore}/100). Priorisez la maîtrise des enveloppes en dépassement et le suivi de vos échéances de dettes.`;
  }

  return {
    healthScore,
    healthLabel,
    summary,
    recommendations,
    breakdown: {
      essentialsPercent,
      solidarityAndTithePercent,
      leisurePercent,
      savingsPercent,
      debtRatioPercent,
    },
  };
}
