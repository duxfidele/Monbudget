import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { deduplicateCategories } from "@/lib/utils/budget-calc";

export type Category = { 
  id: string; 
  name: string; 
  amount: number; 
  color: string; 
  allocation_id?: string 
};

export type Transaction = { 
  id: string; 
  label: string; 
  amount: number; 
  category: string; 
  category_id?: string; 
  date: string; 
  type: "expense" | "income" | "income_adjustment";
};

export type SavingsContribution = {
  id: string;
  amount: number;
  date: string;
  notes?: string;
};

export type SavingsGoal = {
  id: string;
  name: string;
  target: number;
  current: number;
  color: string;
  target_date?: string;
  status: "active" | "completed" | "paused";
  contributions: SavingsContribution[];
};

export interface MonthData {
  baseSalary: number;
  income: number;
  categories: Category[];
  transactions: Transaction[];
}

export interface LocalCache {
  currency: string;
  payDay: number;
  alertThreshold: number;
  fullName?: string;
  months: Record<string, MonthData>;
  savingsGoals: SavingsGoal[];
}

interface UIState {
  // Navigation
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  
  // Dates
  activeMonth: { year: number; month: number };
  setActiveMonth: (year: number, month: number) => void;

  // Global Data
  budget_id: string | null;
  baseSalary: number;
  income: number;
  setIncome: (income: number) => Promise<void>;
  setSalary: (salary: number) => Promise<void>;
  saveBudget: () => Promise<void>;
  
  categories: Category[];
  addCategory: (cat: Category) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  updateCategory: (id: string, updates: Partial<{ name: string; color: string }>) => Promise<void>;
  updateCategoryAmount: (id: string, amount: number) => Promise<void>;
  
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;

  savingsGoals: SavingsGoal[];
  addSavingsGoal: (goal: { name: string; target: number; color?: string; target_date?: string }) => Promise<void>;
  removeSavingsGoal: (id: string) => Promise<void>;
  updateSavingsGoalStatus: (id: string, status: "active" | "completed" | "paused") => Promise<void>;
  addSavingsContribution: (goalId: string, amount: number, notes?: string, date?: string) => Promise<void>;
  removeSavingsContribution: (contributionId: string, goalId: string) => Promise<void>;
  addSavingsAmount: (id: string, amount: number) => Promise<void>;

  // Preferences & Init
  alertThreshold: number;
  currency: string;
  payDay: number;
  updatePreferences: (prefs: { alertThreshold?: number; currency?: string; payDay?: number; fullName?: string }) => Promise<void>;
  updateAlertThreshold: (percent: number) => Promise<void>;
  duplicatePreviousMonth: () => Promise<{ prevMonthName: string; allocationsCount: number; income: number }>;
  isLoading: boolean;
  initStore: () => Promise<void>;
}

const STORAGE_KEY = "monbudget_local_cache_v3";
const currentDate = new Date();
const supabase = createClient();

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export { deduplicateCategories };

function loadLocalCache(): LocalCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cache: LocalCache = JSON.parse(raw);
    let mutated = false;
    if (!cache.currency || cache.currency === "EUR") {
      cache.currency = "FCFA";
      mutated = true;
    }
    if (cache.months) {
      for (const k of Object.keys(cache.months)) {
        const m = cache.months[k];
        if (m.categories) {
          const cleanCats = deduplicateCategories(m.categories);
          if (cleanCats.length !== m.categories.length) {
            m.categories = cleanCats;
            mutated = true;
          }
        }
        if (m.transactions) {
          m.transactions = m.transactions.map((tx) => {
            const isInc = tx.type === "income" || tx.type === "income_adjustment";
            if (isInc && (tx.category === "Alimentation" || !tx.category)) {
              mutated = true;
              return { ...tx, category: "Revenu", category_id: undefined };
            }
            return tx;
          });
        }
      }
    }
    if (mutated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      } catch {}
    }
    return cache;
  } catch {
    return null;
  }
}

function saveLocalCache(cache: LocalCache) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn("Could not save to localStorage", err);
  }
}

// Hydratation initiale synchrone
const initialCache = loadLocalCache();
const initialMonthKey = getMonthKey(currentDate.getFullYear(), currentDate.getMonth() + 1);
const initialMonthData = initialCache?.months?.[initialMonthKey];

// Debounce timers pour la saisie sans lag
const allocationDebounceTimers: Record<string, NodeJS.Timeout> = {};
let incomeDebounceTimer: NodeJS.Timeout | null = null;

export const useUIStore = create<UIState>((set, get) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  
  activeMonth: { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 },
  setActiveMonth: (year, month) => {
    // 1. Sauvegarder l état du mois courant dans le cache local
    const curState = get();
    const curKey = getMonthKey(curState.activeMonth.year, curState.activeMonth.month);
    const cache = loadLocalCache() || {
      currency: curState.currency || "FCFA",
      payDay: curState.payDay || 28,
      alertThreshold: curState.alertThreshold || 80,
      months: {},
      savingsGoals: curState.savingsGoals,
    };

    cache.months[curKey] = {
      baseSalary: curState.baseSalary,
      income: curState.income,
      categories: curState.categories,
      transactions: curState.transactions,
    };
    saveLocalCache(cache);

    // 2. Préparer le nouveau mois
    const newKey = getMonthKey(year, month);
    const cachedMonth = cache.months[newKey];

    if (cachedMonth) {
      set({
        activeMonth: { year, month },
        baseSalary: cachedMonth.baseSalary || 0,
        income: cachedMonth.income || 0,
        categories: deduplicateCategories(cachedMonth.categories || []),
        transactions: (cachedMonth.transactions || []).map((tx) => {
          const isInc = tx.type === "income" || tx.type === "income_adjustment";
          return isInc && (tx.category === "Alimentation" || !tx.category)
            ? { ...tx, category: "Revenu", category_id: undefined }
            : tx;
        }),
      });
    } else {
      // Hériter des catégories existantes avec montant 0 si nouveau mois
      const defaultCats = deduplicateCategories(curState.categories).map((c) => ({ ...c, amount: 0, allocation_id: undefined }));
      set({
        activeMonth: { year, month },
        baseSalary: 0,
        income: 0,
        categories: defaultCats,
        transactions: [],
      });
    }

    // 3. Sync Supabase en arrière-plan
    get().initStore();
  },

  alertThreshold: initialCache?.alertThreshold ?? 80,
  currency: (initialCache?.currency && initialCache.currency !== "EUR") ? initialCache.currency : "FCFA",
  payDay: initialCache?.payDay ?? 28,
  isLoading: false,
  budget_id: null,
  baseSalary: initialMonthData?.baseSalary || 0,
  income: initialMonthData?.income || 0,
  categories: deduplicateCategories(initialMonthData?.categories || []),
  transactions: (initialMonthData?.transactions || []).map((tx) => {
    const isInc = tx.type === "income" || tx.type === "income_adjustment";
    return isInc && (tx.category === "Alimentation" || !tx.category)
      ? { ...tx, category: "Revenu", category_id: undefined }
      : tx;
  }),
  savingsGoals: initialCache?.savingsGoals || [],

  initStore: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { year, month } = get().activeMonth;
      const monthKey = getMonthKey(year, month);

      // 1. Profil & Préférences
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!profile) {
        await supabase.from("profiles").insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || "Utilisateur",
          currency: "FCFA",
          alert_threshold_percent: 80,
          pay_day: 28,
        });
        set({ currency: "FCFA", alertThreshold: 80, payDay: 28 });
      } else {
        let cur = profile.currency && profile.currency.trim() ? profile.currency : "FCFA";
        if (cur === "EUR") {
          cur = "FCFA";
          try {
            await supabase.from("profiles").update({ currency: "FCFA" }).eq("id", user.id);
          } catch (e) {
            console.warn("Could not migrate profile currency to FCFA", e);
          }
        }
        const th = profile.alert_threshold_percent ? Number(profile.alert_threshold_percent) : 80;
        const pd = profile.pay_day ? Number(profile.pay_day) : 28;
        set({ currency: cur, alertThreshold: th, payDay: pd });

        const cache = loadLocalCache();
        if (cache) {
          cache.currency = cur;
          saveLocalCache(cache);
        }
      }

      // 2. Budget mensuel
      let { data: budget } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      if (!budget) {
        const { data: newBudget } = await supabase
          .from("monthly_budgets")
          .insert({ user_id: user.id, year, month })
          .select()
          .maybeSingle();
        budget = newBudget;
      }

      if (budget) {
        set({ budget_id: budget.id });

        // 3. Revenus de base (salaire)
        const { data: incomes } = await supabase
          .from("income_entries")
          .select("*")
          .eq("monthly_budget_id", budget.id);

        const fetchedBaseSalary = incomes?.reduce((sum, inc) => sum + Number(inc.amount), 0) || 0;

        // 4. Catégories & Allocations
        const { data: allCategories } = await supabase
          .from("categories")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true);

        const { data: allocations } = await supabase
          .from("budget_allocations")
          .select("*")
          .eq("monthly_budget_id", budget.id);

        const rawCategories: Category[] = (allCategories || []).map((cat) => {
          const alloc = allocations?.find((a) => a.category_id === cat.id);
          return {
            id: cat.id,
            name: cat.name.trim(),
            color: cat.color || "bg-blue-500",
            amount: alloc ? Number(alloc.allocated_amount) : 0,
            allocation_id: alloc?.id,
          };
        });
        const categoriesMap: Category[] = deduplicateCategories(rawCategories);

        // Si des catégories en doublon existent dans Supabase, archiver les doublons superflus
        const seenCatNames = new Set<string>();
        const redundantCatIds: string[] = [];
        for (const cat of (allCategories || [])) {
          const norm = cat.name.trim().toLowerCase();
          if (seenCatNames.has(norm)) {
            redundantCatIds.push(cat.id);
          } else {
            seenCatNames.add(norm);
          }
        }
        if (redundantCatIds.length > 0) {
          supabase.from("categories").update({ is_active: false }).in("id", redundantCatIds).then();
        }

        // 5. Transactions
        const { data: txs } = await supabase
          .from("transactions")
          .select("*, categories(name)")
          .eq("monthly_budget_id", budget.id)
          .order("transaction_date", { ascending: false });

        const mappedTxs: Transaction[] = (txs || []).map((tx) => {
          const isInc = tx.type === "income" || tx.type === "income_adjustment";
          return {
            id: tx.id,
            label: tx.description || (isInc ? "Revenu complémentaire" : "Dépense"),
            amount: Number(tx.amount),
            category: isInc ? "Revenu" : (tx.categories?.name || "Autre (Hors Budget)"),
            category_id: isInc ? undefined : tx.category_id,
            date: tx.transaction_date,
            type: isInc ? "income" : "expense",
          };
        });

        // Nettoyer en arrière-plan tout rattachement erroné de catégorie sur des revenus historiques dans Supabase
        const badIncomeTxs = (txs || []).filter(t => (t.type === "income" || t.type === "income_adjustment") && t.category_id !== null);
        if (badIncomeTxs.length > 0) {
          const badIds = badIncomeTxs.map(t => t.id);
          supabase.from("transactions").update({ category_id: null }).in("id", badIds).then();
        }

        // Calcul du revenu total : Salaire de base + revenus supplémentaires des transactions
        const additionalIncomes = mappedTxs
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0);

        const totalIncome = fetchedBaseSalary + additionalIncomes;

        // FUSION RIGOUREUSE : Ne JAMAIS écraser les montants saisis localement avec 0
        const currentCats = get().categories;
        const mergedCats: Category[] = categoriesMap.map((remoteCat) => {
          const localMatch = currentCats.find(
            (c) => c.name.trim().toLowerCase() === remoteCat.name.trim().toLowerCase()
          );
          // Si Supabase a une allocation > 0, on prend la valeur distante
          if (remoteCat.amount > 0) {
            return remoteCat;
          }
          // Si le local a une valeur > 0 saisie par l'utilisateur, ON LA PRÉSERVE IMPÉRATIVEMENT
          if (localMatch && localMatch.amount > 0) {
            return {
              ...remoteCat,
              amount: localMatch.amount,
              color: localMatch.color || remoteCat.color,
            };
          }
          return remoteCat;
        });

        // Conserver également toute catégorie locale non présente dans remoteCat
        for (const localCat of currentCats) {
          const exists = mergedCats.some(
            (c) => c.name.trim().toLowerCase() === localCat.name.trim().toLowerCase()
          );
          if (!exists) {
            mergedCats.push(localCat);
          }
        }

        const finalCats = mergedCats.length > 0 ? deduplicateCategories(mergedCats) : currentCats;

        // Pour le salaire : préserver la saisie locale si elle est > 0
        const localBaseSalary = get().baseSalary;
        const finalBaseSalary = localBaseSalary > 0 ? localBaseSalary : (fetchedBaseSalary > 0 ? fetchedBaseSalary : 0);
        const finalIncome = finalBaseSalary + additionalIncomes;

        set({
          baseSalary: finalBaseSalary,
          income: finalIncome,
          categories: finalCats,
          transactions: mappedTxs,
        });

        // Synchroniser en arrière-plan les allocations locales vers Supabase si elles manquaient
        if (budget && user) {
          for (const cat of finalCats) {
            if (cat.amount > 0 && !cat.allocation_id) {
              supabase
                .from("budget_allocations")
                .upsert(
                  { monthly_budget_id: budget.id, category_id: cat.id, allocated_amount: cat.amount },
                  { onConflict: "monthly_budget_id,category_id" }
                )
                .then();
            }
          }
          if (finalBaseSalary > 0 && fetchedBaseSalary === 0) {
            supabase
              .from("income_entries")
              .insert({
                monthly_budget_id: budget.id,
                label: "Salaire principal",
                amount: finalBaseSalary,
                received_date: new Date().toISOString().split("T")[0],
              })
              .then();
          }
        }

        // Mettre à jour le cache local
        const cache = loadLocalCache() || {
          currency: get().currency,
          payDay: get().payDay,
          alertThreshold: get().alertThreshold,
          months: {},
          savingsGoals: get().savingsGoals,
        };
        cache.months[monthKey] = {
          baseSalary: finalBaseSalary,
          income: finalIncome,
          categories: finalCats,
          transactions: mappedTxs,
        };
        saveLocalCache(cache);
      }

      // 6. Objectifs d épargne
      const { data: goals } = await supabase
        .from("savings_goals")
        .select("*, savings_contributions(*)")
        .eq("user_id", user.id);

      if (goals && goals.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedGoals: SavingsGoal[] = goals.map((g: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const contributions: SavingsContribution[] = (g.savings_contributions || []).map((c: any) => ({
            id: c.id,
            amount: Number(c.amount),
            date: c.contribution_date,
            notes: c.notes || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

          const sumContribs = contributions.reduce((s, c) => s + c.amount, 0);
          const current = contributions.length > 0 ? sumContribs : Number(g.current_amount || 0);

          return {
            id: g.id,
            name: g.name,
            target: Number(g.target_amount),
            current,
            target_date: g.target_date || undefined,
            status: (g.status as "active" | "completed" | "paused") || "active",
            color: g.color || "bg-blue-500",
            contributions,
          };
        });
        set({ savingsGoals: mappedGoals });
      }
    } catch (e) {
      console.warn("Notice: Offline or local mode active", e);
    }
  },

  updatePreferences: async (prefs) => {
    const newCurrency = prefs.currency !== undefined ? (prefs.currency.trim() || "FCFA") : get().currency;
    const newAlert = prefs.alertThreshold ?? get().alertThreshold;
    const newPayDay = prefs.payDay ?? get().payDay;

    set({
      alertThreshold: newAlert,
      currency: newCurrency,
      payDay: newPayDay,
    });

    // Sauvegarde locale instantanée
    const cache = loadLocalCache() || {
      currency: newCurrency,
      payDay: newPayDay,
      alertThreshold: newAlert,
      months: {},
      savingsGoals: get().savingsGoals,
    };
    cache.currency = newCurrency;
    cache.alertThreshold = newAlert;
    cache.payDay = newPayDay;
    if (prefs.fullName) cache.fullName = prefs.fullName;
    saveLocalCache(cache);

    // Sync Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const updates: Record<string, any> = {};
      if (prefs.alertThreshold !== undefined) updates.alert_threshold_percent = prefs.alertThreshold;
      if (prefs.currency !== undefined) updates.currency = newCurrency;
      if (prefs.payDay !== undefined) updates.pay_day = prefs.payDay;
      if (prefs.fullName !== undefined) {
        updates.full_name = prefs.fullName;
        await supabase.auth.updateUser({ data: { full_name: prefs.fullName } });
      }
      await supabase.from("profiles").update(updates).eq("id", user.id);
    } catch (err) {
      console.warn("Could not sync preferences to Supabase", err);
    }
  },

  updateAlertThreshold: async (percent) => {
    await get().updatePreferences({ alertThreshold: percent });
  },

  setSalary: async (salary) => {
    const additionalIncomes = get().transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const baseSalary = Math.max(0, salary);
    const totalIncome = baseSalary + additionalIncomes;

    // 1. Mise à jour synchrone en mémoire : le salaire ne change jamais tout seul
    set({ baseSalary, income: totalIncome });

    // 2. Sauvegarde locale instantanée
    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache() || {
      currency: get().currency,
      payDay: get().payDay,
      alertThreshold: get().alertThreshold,
      months: {},
      savingsGoals: get().savingsGoals,
    };
    cache.months[monthKey] = {
      baseSalary,
      income: totalIncome,
      categories: get().categories,
      transactions: get().transactions,
    };
    saveLocalCache(cache);

    // 3. Sync Supabase debouncée
    if (incomeDebounceTimer) clearTimeout(incomeDebounceTimer);
    incomeDebounceTimer = setTimeout(async () => {
      try {
        const budgetId = get().budget_id;
        if (!budgetId) return;
        const { data: existing } = await supabase
          .from("income_entries")
          .select("id")
          .eq("monthly_budget_id", budgetId);

        if (existing && existing.length > 0) {
          await supabase
            .from("income_entries")
            .update({ amount: baseSalary, label: "Salaire principal" })
            .eq("id", existing[0].id);
        } else {
          await supabase
            .from("income_entries")
            .insert({
              monthly_budget_id: budgetId,
              label: "Salaire principal",
              amount: baseSalary,
              received_date: new Date().toISOString().split("T")[0],
            });
        }
      } catch (err) {
        console.warn("Could not sync income to Supabase", err);
      }
    }, 600);
  },

  setIncome: async (income) => {
    // Si l'utilisateur saisit directement un revenu, on le traite comme son salaire principal
    await get().setSalary(income);
  },

  saveBudget: async () => {
    const curState = get();
    const { year, month } = curState.activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache() || {
      currency: curState.currency,
      payDay: curState.payDay,
      alertThreshold: curState.alertThreshold,
      months: {},
      savingsGoals: curState.savingsGoals,
    };
    cache.months[monthKey] = {
      baseSalary: curState.baseSalary,
      income: curState.income,
      categories: curState.categories,
      transactions: curState.transactions,
    };
    saveLocalCache(cache);

    try {
      const budgetId = curState.budget_id;
      if (!budgetId) return;

      // Sauvegarde salaire Supabase
      const { data: existing } = await supabase
        .from("income_entries")
        .select("id")
        .eq("monthly_budget_id", budgetId);

      if (existing && existing.length > 0) {
        await supabase
          .from("income_entries")
          .update({ amount: curState.baseSalary, label: "Salaire principal" })
          .eq("id", existing[0].id);
      } else if (curState.baseSalary > 0) {
        await supabase
          .from("income_entries")
          .insert({
            monthly_budget_id: budgetId,
            label: "Salaire principal",
            amount: curState.baseSalary,
            received_date: new Date().toISOString().split("T")[0],
          });
      }

      // Sauvegarde des allocations pour chaque catégorie
      for (const cat of curState.categories) {
        if (cat.allocation_id) {
          await supabase
            .from("budget_allocations")
            .update({ allocated_amount: cat.amount })
            .eq("id", cat.allocation_id);
        } else {
          const { data: newAlloc } = await supabase
            .from("budget_allocations")
            .insert({ monthly_budget_id: budgetId, category_id: cat.id, allocated_amount: cat.amount })
            .select()
            .single();
          if (newAlloc) {
            cat.allocation_id = newAlloc.id;
          }
        }
      }
    } catch (e) {
      console.warn("Could not sync budget to Supabase", e);
    }
  },

  addCategory: async (cat) => {
    const trimmedName = cat.name.trim();
    if (!trimmedName) return;

    // Empêcher l ajout de doublon (ex: Déplacement déjà existant)
    const exists = get().categories.some((c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      return;
    }

    // Générer un UUID valide si l'id n'est pas au format UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const catId = uuidRegex.test(cat.id) ? cat.id : (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : cat.id);
    const newCategoryItem = { ...cat, id: catId, name: trimmedName };

    const updated = deduplicateCategories([...get().categories, newCategoryItem]);
    set({ categories: updated });

    // Sauvegarde locale immédiate
    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].categories = updated;
      saveLocalCache(cache);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: newCat } = await supabase
        .from("categories")
        .insert({ id: catId, user_id: user.id, name: trimmedName, color: cat.color })
        .select()
        .single();
      if (newCat) {
        cat.id = newCat.id;
        const syncedCats = get().categories.map((c) => (c.name === trimmedName ? { ...c, id: newCat.id } : c));
        set({ categories: syncedCats });
        if (cache && cache.months[monthKey]) {
          cache.months[monthKey].categories = syncedCats;
          saveLocalCache(cache);
        }
      }
    } catch (err) {
      console.warn("Could not sync category to Supabase", err);
    }
  },

  removeCategory: async (id) => {
    const updated = get().categories.filter((c) => c.id !== id);
    set({ categories: updated });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].categories = updated;
      saveLocalCache(cache);
    }

    try {
      await supabase.from("categories").update({ is_active: false }).eq("id", id);
    } catch (err) {
      console.warn("Could not remove category from Supabase", err);
    }
  },

  updateCategory: async (id, updates) => {
    const updated = get().categories.map((c) => (c.id === id ? { ...c, ...updates } : c));
    set({ categories: updated });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].categories = updated;
      saveLocalCache(cache);
    }

    try {
      await supabase.from("categories").update(updates).eq("id", id);
    } catch (err) {
      console.warn("Could not update category in Supabase", err);
    }
  },

  updateCategoryAmount: async (id, amount) => {
    const updated = get().categories.map((c) => (c.id === id ? { ...c, amount } : c));
    set({ categories: updated });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].categories = updated;
      saveLocalCache(cache);
    }

    if (allocationDebounceTimers[id]) clearTimeout(allocationDebounceTimers[id]);
    allocationDebounceTimers[id] = setTimeout(async () => {
      try {
        const budgetId = get().budget_id;
        if (!budgetId) return;
        const category = get().categories.find((c) => c.id === id);
        if (!category) return;

        if (category.allocation_id) {
          await supabase.from("budget_allocations").update({ allocated_amount: amount }).eq("id", category.allocation_id);
        } else {
          const { data: newAlloc } = await supabase
            .from("budget_allocations")
            .insert({ monthly_budget_id: budgetId, category_id: id, allocated_amount: amount })
            .select()
            .single();
          if (newAlloc) {
            set((state) => ({
              categories: state.categories.map((c) => (c.id === id ? { ...c, allocation_id: newAlloc.id } : c)),
            }));
          }
        }
      } catch (err) {
        console.warn("Could not sync allocation to Supabase", err);
      }
    }, 600);
  },

  addTransaction: async (tx) => {
    const isInc = tx.type === "income" || tx.type === "income_adjustment";
    const normalizedType: "income" | "expense" = isInc ? "income" : "expense";
    const transactionItem: Transaction = {
      ...tx,
      type: normalizedType,
      category: tx.category || (isInc ? "Revenu" : "Autre (Hors Budget)"),
    };

    const newTransactions = [transactionItem, ...get().transactions];
    const newIncome = isInc ? get().income + tx.amount : get().income;

    set({
      transactions: newTransactions,
      income: newIncome,
    });

    // Sauvegarde locale instantanée
    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].transactions = newTransactions;
      cache.months[monthKey].income = newIncome;
      saveLocalCache(cache);
    }

    try {
      const budgetId = get().budget_id;
      if (!budgetId) return;

      let category_id = null;
      if (!isInc) {
        const cat = get().categories.find((c) => c.name.toLowerCase() === tx.category.toLowerCase());
        if (cat) category_id = cat.id;
      }

      const { data: newTx } = await supabase
        .from("transactions")
        .insert({
          monthly_budget_id: budgetId,
          category_id,
          amount: tx.amount,
          description: tx.label,
          transaction_date: tx.date,
          type: isInc ? "income_adjustment" : "expense",
        })
        .select()
        .single();

      if (newTx) {
        transactionItem.id = newTx.id;
      }
    } catch (err) {
      console.warn("Could not sync transaction to Supabase", err);
    }
  },

  removeTransaction: async (id) => {
    const tx = get().transactions.find((t) => t.id === id);
    const newTransactions = get().transactions.filter((t) => t.id !== id);
    let newIncome = get().income;
    if (tx && (tx.type === "income" || tx.type === "income_adjustment")) {
      newIncome = Math.max(0, newIncome - tx.amount);
    }

    set({
      transactions: newTransactions,
      income: newIncome,
    });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].transactions = newTransactions;
      cache.months[monthKey].income = newIncome;
      saveLocalCache(cache);
    }

    try {
      await supabase.from("transactions").delete().eq("id", id);
    } catch (err) {
      console.warn("Could not delete transaction from Supabase", err);
    }
  },

  duplicatePreviousMonth: async () => {
    const { year, month } = get().activeMonth;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevMonthName = new Date(prevYear, prevMonth - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const prevKey = getMonthKey(prevYear, prevMonth);

    const cache = loadLocalCache();
    const prevMonthData = cache?.months?.[prevKey];

    let copiedIncome = 0;
    let allocationsCount = 0;

    if (prevMonthData && prevMonthData.categories.length > 0) {
      copiedIncome = prevMonthData.baseSalary || prevMonthData.income;
      const duplicatedCats = prevMonthData.categories.map((c) => ({ ...c, allocation_id: undefined }));
      allocationsCount = duplicatedCats.filter((c) => c.amount > 0).length;

      set({
        baseSalary: copiedIncome,
        income: copiedIncome,
        categories: duplicatedCats,
      });

      const currentKey = getMonthKey(year, month);
      if (cache) {
        cache.months[currentKey] = {
          baseSalary: copiedIncome,
          income: copiedIncome,
          categories: duplicatedCats,
          transactions: get().transactions,
        };
        saveLocalCache(cache);
      }
    } else {
      // Tenter depuis Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prevBudget } = await supabase
          .from("monthly_budgets")
          .select("id")
          .eq("user_id", user.id)
          .eq("year", prevYear)
          .eq("month", prevMonth)
          .maybeSingle();

        if (prevBudget) {
          const { data: prevIncomes } = await supabase
            .from("income_entries")
            .select("amount")
            .eq("monthly_budget_id", prevBudget.id);

          const { data: prevAllocations } = await supabase
            .from("budget_allocations")
            .select("category_id, allocated_amount")
            .eq("monthly_budget_id", prevBudget.id);

          if (prevIncomes && prevIncomes.length > 0) {
            copiedIncome = prevIncomes.reduce((s, i) => s + Number(i.amount), 0);
          }

          if (prevAllocations && prevAllocations.length > 0) {
            allocationsCount = prevAllocations.length;
            const updatedCats = get().categories.map((c) => {
              const prev = prevAllocations.find((a) => a.category_id === c.id);
              return { ...c, amount: prev ? Number(prev.allocated_amount) : c.amount };
            });
            set({ categories: updatedCats });
          }
          await get().setIncome(copiedIncome);
        }
      }
    }

    return {
      prevMonthName,
      allocationsCount,
      income: copiedIncome,
    };
  },

  addSavingsGoal: async (goal) => {
    const newGoal: SavingsGoal = {
      id: Date.now().toString(),
      name: goal.name,
      target: goal.target,
      current: 0,
      color: goal.color || "bg-blue-500",
      target_date: goal.target_date,
      status: "active",
      contributions: [],
    };

    const updated = [newGoal, ...get().savingsGoals];
    set({ savingsGoals: updated });

    const cache = loadLocalCache();
    if (cache) {
      cache.savingsGoals = updated;
      saveLocalCache(cache);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: created } = await supabase
        .from("savings_goals")
        .insert({
          user_id: user.id,
          name: goal.name,
          target_amount: goal.target,
          color: goal.color || "bg-blue-500",
          target_date: goal.target_date || null,
          status: "active",
          current_amount: 0,
        })
        .select()
        .single();
      if (created) {
        newGoal.id = created.id;
      }
    } catch (err) {
      console.warn("Could not sync goal to Supabase", err);
    }
  },

  removeSavingsGoal: async (id) => {
    const updated = get().savingsGoals.filter((g) => g.id !== id);
    set({ savingsGoals: updated });

    const cache = loadLocalCache();
    if (cache) {
      cache.savingsGoals = updated;
      saveLocalCache(cache);
    }

    try {
      await supabase.from("savings_goals").delete().eq("id", id);
    } catch (err) {
      console.warn("Could not delete goal from Supabase", err);
    }
  },

  updateSavingsGoalStatus: async (id, status) => {
    const updated = get().savingsGoals.map((g) => (g.id === id ? { ...g, status } : g));
    set({ savingsGoals: updated });

    const cache = loadLocalCache();
    if (cache) {
      cache.savingsGoals = updated;
      saveLocalCache(cache);
    }

    try {
      await supabase.from("savings_goals").update({ status }).eq("id", id);
    } catch (err) {
      console.warn("Could not update goal status in Supabase", err);
    }
  },

  addSavingsContribution: async (goalId, amount, notes, date) => {
    const goal = get().savingsGoals.find((g) => g.id === goalId);
    if (!goal) return;

    const contributionDate = date || new Date().toISOString().split("T")[0];
    const contribItem: SavingsContribution = {
      id: Date.now().toString(),
      amount,
      date: contributionDate,
      notes: notes || undefined,
    };

    const newCurrent = goal.current + amount;
    const updatedGoals = get().savingsGoals.map((g) => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        current: newCurrent,
        status: newCurrent >= g.target ? ("completed" as const) : g.status,
        contributions: [contribItem, ...(g.contributions || [])],
      };
    });

    set({ savingsGoals: updatedGoals });

    const cache = loadLocalCache();
    if (cache) {
      cache.savingsGoals = updatedGoals;
      saveLocalCache(cache);
    }

    try {
      const { data: newContrib } = await supabase
        .from("savings_contributions")
        .insert({
          savings_goal_id: goalId,
          amount,
          contribution_date: contributionDate,
          notes: notes || null,
        })
        .select()
        .single();

      if (newContrib) {
        contribItem.id = newContrib.id;
      }
      await supabase.from("savings_goals").update({ current_amount: newCurrent }).eq("id", goalId);
    } catch (err) {
      console.warn("Could not sync savings contribution to Supabase", err);
    }
  },

  removeSavingsContribution: async (contributionId, goalId) => {
    const updatedGoals = get().savingsGoals.map((g) => {
      if (g.id !== goalId) return g;
      const filtered = (g.contributions || []).filter((c) => c.id !== contributionId);
      const newCurrent = filtered.reduce((s, c) => s + c.amount, 0);
      return {
        ...g,
        current: newCurrent,
        status: newCurrent >= g.target ? ("completed" as const) : ("active" as const),
        contributions: filtered,
      };
    });

    set({ savingsGoals: updatedGoals });

    const cache = loadLocalCache();
    if (cache) {
      cache.savingsGoals = updatedGoals;
      saveLocalCache(cache);
    }

    try {
      await supabase.from("savings_contributions").delete().eq("id", contributionId);
    } catch (err) {
      console.warn("Could not delete savings contribution from Supabase", err);
    }
  },

  addSavingsAmount: async (id, amount) => {
    await get().addSavingsContribution(id, amount);
  },
}));
