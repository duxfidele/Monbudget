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
}

export interface DailyBudgetResult {
  dailyBudget: number;
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

export function getTotalExpenses(transactions: TransactionItem[]): number {
  return transactions
    .filter((tx) => isExpenseTransaction(tx))
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
export function getSpentByCategory(transactions: TransactionItem[], categoryName: string): number {
  const normalized = categoryName.trim().toLowerCase();
  return transactions
    .filter(
      (tx) =>
        isExpenseTransaction(tx) &&
        (tx.category || "").trim().toLowerCase() === normalized
    )
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
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

  // Calcul du montant journalier
  const dailyBudget = remainingAmount > 0 ? Math.floor(remainingAmount / daysRemaining) : 0;

  // Détermination du statut et du conseil
  let status: "healthy" | "warning" | "critical" = "healthy";
  let advice = "";

  if (remainingAmount <= 0) {
    status = "critical";
    advice = "Attention ! Votre reste à vivre est épuisé. Évitez toute dépense non essentielle.";
  } else {
    const percentRemaining = totalIncome > 0 ? (remainingAmount / totalIncome) * 100 : 50;
    
    if (percentRemaining < 15 || dailyBudget < 1500) {
      status = "warning";
      advice = `Rythme serré : limitez vos dépenses à ${dailyBudget.toLocaleString("fr-FR")} FCFA/jour pour tenir jusqu'à la paie.`;
    } else {
      status = "healthy";
      advice = `Allure excellente : vous pouvez dépenser jusqu'à ${dailyBudget.toLocaleString("fr-FR")} FCFA par jour en toute sérénité.`;
    }
  }

  return {
    dailyBudget,
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
  if (safeCurrency === "USD") return `${formatted}`;
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
