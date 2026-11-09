import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { getUserStorageKey } from "@/lib/utils/security";
import { toast } from "sonner";
import {
  deduplicateCategories,
  DebtItem,
  DebtPaymentItem,
  IncomeSourceType,
  getMonthlySavingsContributions,
  getSpentByCategory,
  AFRICAN_EXPENSE_CATEGORIES,
} from "@/lib/utils/budget-calc";
import {
  BillingCycle,
  SubscriptionPlanId,
  SubscriptionStatus,
} from "@/lib/moneriz-plans";

export type IncomeSourceEntry = {
  id: string;
  label: string;
  sourceType: IncomeSourceType | string;
  amount: number;
  date?: string;
};

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
  linkedDebtId?: string;
  linkedPaymentId?: string;
  linkedSavingsGoalId?: string;
  linkedContributionId?: string;
  receiptUrl?: string;
  receiptName?: string;
};

export type SavingsContribution = {
  id: string;
  amount: number;
  date: string;
  notes?: string;
  linkedTransactionId?: string;
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
  incomeEntries?: IncomeSourceEntry[];
  categories: Category[];
  transactions: Transaction[];
}

export interface NotificationSettings {
  budgetAlert: boolean;
  budgetAlertThreshold: number;
  payDayReminder: boolean;
  payDayReminderDays: number;
  weeklySummary: boolean;
}

export const defaultNotifications: NotificationSettings = {
  budgetAlert: true,
  budgetAlertThreshold: 80,
  payDayReminder: true,
  payDayReminderDays: 7,
  weeklySummary: false,
};

export type PendingSyncAction = {
  id: string;
  type: 
    | "add_transaction" 
    | "remove_transaction" 
    | "update_category_amount" 
    | "update_income" 
    | "add_income_entry"
    | "remove_income_entry"
    | "add_savings_goal"
    | "update_savings_goal"
    | "add_savings_contribution"
    | "add_debt"
    | "add_debt_payment"
    | "remove_debt"
    | "update_preferences";
  payload: any;
  timestamp: number;
};

export interface LocalCache {
  currency: string;
  payDay: number;
  alertThreshold: number;
  fullName?: string;
  notifications?: NotificationSettings;
  months: Record<string, MonthData>;
  savingsGoals: SavingsGoal[];
  debts?: DebtItem[];
  pendingSyncQueue?: PendingSyncAction[];
  subscriptionPlan?: SubscriptionPlanId;
  billingCycle?: BillingCycle | "none";
  subscriptionExpiresAt?: string | null;
  subscriptionStatus?: SubscriptionStatus;
}

interface UIState {
  // Navigation
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  
  // Dates
  activeMonth: { year: number; month: number };
  setActiveMonth: (year: number, month: number) => void;

  // Session & Cache
  userId: string | null;
  resetStore: () => void;

  // Offline & PWA Sync Engine
  isOnline: boolean;
  pendingSyncCount: number;
  canInstallPwa: boolean;
  isPwaInstalled: boolean;
  setOnlineStatus: (online: boolean) => void;
  setDeferredPrompt: (prompt: any) => void;
  setAppInstalled: () => void;
  installPwa: () => Promise<boolean>;
  syncPendingQueue: () => Promise<number>;
  enqueueSyncAction: (action: Omit<PendingSyncAction, "id" | "timestamp">) => void;

  // Global Data
  budget_id: string | null;
  baseSalary: number;
  income: number;
  incomeEntries: IncomeSourceEntry[];
  setIncome: (income: number) => Promise<void>;
  setSalary: (salary: number) => Promise<void>;
  addIncomeEntry: (entry: { label: string; sourceType: string; amount: number; date?: string }) => Promise<void>;
  removeIncomeEntry: (id: string) => Promise<void>;
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

  debts: DebtItem[];
  addDebt: (debt: {
    type: "payable" | "receivable";
    personName: string;
    phone?: string;
    totalAmount: number;
    dueDate?: string;
    notes?: string;
  }) => Promise<void>;
  removeDebt: (id: string) => Promise<void>;
  addDebtPayment: (debtId: string, amount: number, notes?: string, date?: string) => Promise<void>;
  removeDebtPayment: (paymentId: string, debtId: string) => Promise<void>;

  // Abonnement SaaS (Moneriz) & Rôle Admin (évalué côté serveur uniquement)
  isAdminUser: boolean;
  subscriptionPlan: SubscriptionPlanId;
  billingCycle: BillingCycle | "none";
  subscriptionExpiresAt: string | null;
  subscriptionStatus: SubscriptionStatus;
  refreshSubscription: (orderId?: string | null, paymentId?: string | null) => Promise<{
    planId: SubscriptionPlanId;
    orderStatus: string | null;
    isAdmin: boolean;
  }>;

  // Preferences & Init
  alertThreshold: number;
  currency: string;
  payDay: number;
  notifications: NotificationSettings;
  updatePreferences: (prefs: { 
    alertThreshold?: number; 
    currency?: string; 
    payDay?: number; 
    fullName?: string;
    notifications?: Partial<NotificationSettings>;
  }) => Promise<void>;
  updateNotifications: (notifs: Partial<NotificationSettings>) => Promise<void>;
  updateAlertThreshold: (percent: number) => Promise<void>;
  duplicatePreviousMonth: () => Promise<{ prevMonthName: string; allocationsCount: number; income: number }>;
  isLoading: boolean;
  initStore: () => Promise<void>;
}

function getSavedUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed?.user?.id) return parsed.user.id;
        }
      }
    }
  } catch {}
  return null;
}

let activeUserId: string | null = typeof window !== "undefined" ? getSavedUserId() : null;
let deferredInstallPrompt: any = null;

export function getStorageKey(uid?: string | null): string {
  return getUserStorageKey(uid ?? activeUserId);
}

const currentDate = new Date();
const supabase = createClient();

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export { deduplicateCategories };

function loadLocalCache(uid?: string | null): LocalCache | null {
  if (typeof window === "undefined") return null;
  try {
    const key = getStorageKey(uid);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cache: LocalCache = JSON.parse(raw);
    let mutated = false;
    if (!cache.pendingSyncQueue) {
      cache.pendingSyncQueue = [];
    }
    if (!cache.currency || cache.currency === "EUR" || cache.currency === "€") {
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
        localStorage.setItem(key, JSON.stringify(cache));
      } catch {}
    }
    return cache;
  } catch {
    return null;
  }
}

function saveLocalCache(cache: LocalCache, uid?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey(uid);
    localStorage.setItem(key, JSON.stringify(cache));
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
  userId: activeUserId,
  resetStore: () => {
    if (typeof window !== "undefined") {
      try {
        const currentKey = getStorageKey();
        localStorage.removeItem(currentKey);
        localStorage.removeItem("monbudget_local_cache_v3");
        localStorage.removeItem("monbudget_local_cache_anon");
      } catch {}
    }
    activeUserId = null;
    set({
      userId: null,
      budget_id: null,
      baseSalary: 0,
      income: 0,
      incomeEntries: [],
      categories: [],
      transactions: [],
      savingsGoals: [],
      debts: [],
      isSidebarOpen: false,
      alertThreshold: 80,
      currency: "FCFA",
      payDay: 28,
      notifications: defaultNotifications,
      isAdminUser: false,
      subscriptionPlan: "free",
      billingCycle: "none",
      subscriptionExpiresAt: null,
      subscriptionStatus: "active",
    });
  },

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
      incomeEntries: curState.incomeEntries,
      categories: curState.categories,
      transactions: curState.transactions,
    };
    cache.debts = curState.debts;
    saveLocalCache(cache);

    // 2. Préparer le nouveau mois
    const newKey = getMonthKey(year, month);
    const cachedMonth = cache.months[newKey];

    if (cachedMonth) {
      set({
        activeMonth: { year, month },
        baseSalary: cachedMonth.baseSalary || 0,
        income: cachedMonth.income || 0,
        incomeEntries: cachedMonth.incomeEntries || [],
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
        incomeEntries: [],
        categories: defaultCats,
        transactions: [],
      });
    }

    // 3. Sync Supabase en arrière-plan
    get().initStore();
  },

  alertThreshold: initialCache?.alertThreshold ?? 80,
  currency: (initialCache?.currency && initialCache.currency !== "EUR" && initialCache.currency !== "€") ? initialCache.currency : "FCFA",
  payDay: initialCache?.payDay ?? 28,
  notifications: initialCache?.notifications ? { ...defaultNotifications, ...initialCache.notifications } : defaultNotifications,
  isAdminUser: false,
  subscriptionPlan: initialCache?.subscriptionPlan ?? "free",
  billingCycle: initialCache?.billingCycle ?? "none",
  subscriptionExpiresAt: initialCache?.subscriptionExpiresAt ?? null,
  subscriptionStatus: initialCache?.subscriptionStatus ?? "active",
  refreshSubscription: async (orderId, paymentId) => {
    try {
      const qs = new URLSearchParams();
      if (orderId) qs.set("orderId", orderId);
      if (paymentId) qs.set("paymentId", paymentId);
      const res = await fetch(`/api/checkout/status?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const sub = data?.subscription;
        const serverIsAdmin = Boolean(data?.isAdmin);
        if (sub && sub.planId) {
          const nextStatus: SubscriptionStatus =
            sub.status === "canceled" || sub.status === "expired"
              ? sub.status
              : "active";
          set({
            isAdminUser: serverIsAdmin,
            subscriptionPlan: sub.planId,
            billingCycle: sub.billingCycle || "none",
            subscriptionExpiresAt: sub.currentPeriodEnd || null,
            subscriptionStatus: nextStatus,
          });
          const cache = loadLocalCache();
          if (cache) {
            cache.subscriptionPlan = sub.planId;
            cache.billingCycle = sub.billingCycle || "none";
            cache.subscriptionExpiresAt = sub.currentPeriodEnd || null;
            cache.subscriptionStatus = nextStatus;
            saveLocalCache(cache);
          }
          return {
            planId: sub.planId as SubscriptionPlanId,
            orderStatus: data?.order?.status || null,
            isAdmin: serverIsAdmin,
          };
        }
        set({ isAdminUser: serverIsAdmin });
      }
    } catch {}
    return {
      planId: get().subscriptionPlan,
      orderStatus: null,
      isAdmin: get().isAdminUser,
    };
  },
  isLoading: false,
  budget_id: null,
  baseSalary: initialMonthData?.baseSalary || 0,
  income: initialMonthData?.income || 0,
  incomeEntries: initialMonthData?.incomeEntries || [],

  // Offline & PWA Sync State
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingSyncCount: initialCache?.pendingSyncQueue?.length || 0,
  canInstallPwa: false,
  isPwaInstalled: false,

  setOnlineStatus: (online) => {
    set({ isOnline: online });
  },

  setDeferredPrompt: (prompt) => {
    deferredInstallPrompt = prompt;
    set({ canInstallPwa: true });
  },

  setAppInstalled: () => {
    deferredInstallPrompt = null;
    set({ canInstallPwa: false, isPwaInstalled: true });
  },

  installPwa: async () => {
    const prompt = deferredInstallPrompt || (typeof window !== "undefined" ? (window as any).deferredInstallPrompt : null);
    if (!prompt) return false;
    try {
      prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        set({ canInstallPwa: false, isPwaInstalled: true });
        deferredInstallPrompt = null;
        if (typeof window !== "undefined") (window as any).deferredInstallPrompt = null;
        toast.success("Application MonBudget installée avec succès !");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  enqueueSyncAction: (action) => {
    const syncAction: PendingSyncAction = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...action,
    };
    const cache = loadLocalCache();
    if (cache) {
      if (!cache.pendingSyncQueue) cache.pendingSyncQueue = [];
      cache.pendingSyncQueue.push(syncAction);
      saveLocalCache(cache);
      set({ pendingSyncCount: cache.pendingSyncQueue.length });
    }
  },

  syncPendingQueue: async () => {
    const cache = loadLocalCache();
    if (!cache || !cache.pendingSyncQueue || cache.pendingSyncQueue.length === 0) {
      set({ pendingSyncCount: 0 });
      return 0;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const queue = [...cache.pendingSyncQueue];
    let synced = 0;
    const remaining: PendingSyncAction[] = [];

    for (const item of queue) {
      try {
        switch (item.type) {
          case "add_transaction":
            await supabase.from("transactions").insert(item.payload);
            synced++;
            break;
          case "remove_transaction":
            await supabase.from("transactions").delete().eq("id", item.payload.id);
            synced++;
            break;
          case "update_category_amount":
            if (item.payload.allocation_id) {
              await supabase.from("budget_allocations").update({ allocated_amount: item.payload.amount }).eq("id", item.payload.allocation_id);
            } else if (item.payload.budgetId && item.payload.categoryId) {
              await supabase.from("budget_allocations").insert({
                monthly_budget_id: item.payload.budgetId,
                category_id: item.payload.categoryId,
                allocated_amount: item.payload.amount,
              });
            }
            synced++;
            break;
          case "add_income_entry":
            await supabase.from("income_entries").insert(item.payload);
            synced++;
            break;
          case "remove_income_entry":
            await supabase.from("income_entries").delete().eq("id", item.payload.id);
            synced++;
            break;
          case "add_savings_goal":
            await supabase.from("savings_goals").insert(item.payload);
            synced++;
            break;
          case "add_savings_contribution":
            if (item.payload.goalId) {
              await supabase.from("savings_contributions").insert({
                savings_goal_id: item.payload.goalId,
                amount: item.payload.amount,
                notes: item.payload.notes,
                contribution_date: item.payload.date,
              });
            }
            synced++;
            break;
          case "add_debt":
            await supabase.from("debts").insert(item.payload);
            synced++;
            break;
          case "remove_debt":
            await supabase.from("debts").delete().eq("id", item.payload.id);
            synced++;
            break;
          default:
            synced++;
            break;
        }
      } catch (err) {
        console.warn("Échec de synchronisation de l'action :", item, err);
        remaining.push(item);
      }
    }

    cache.pendingSyncQueue = remaining;
    saveLocalCache(cache);
    set({ pendingSyncCount: remaining.length });

    if (synced > 0) {
      toast.success(`Synchronisation terminée : ${synced} opération(s) synchronisée(s) !`);
      get().initStore();
    }
    return synced;
  },
  categories: (initialMonthData?.categories && initialMonthData.categories.length > 0)
    ? deduplicateCategories(initialMonthData.categories)
    : AFRICAN_EXPENSE_CATEGORIES.map((cat, idx) => ({
        id: `cat-default-${idx}`,
        name: cat.name,
        color: cat.color,
        amount: 0,
      })),
  transactions: (initialMonthData?.transactions || []).map((tx) => {
    const isInc = tx.type === "income" || tx.type === "income_adjustment";
    return isInc && (tx.category === "Alimentation" || !tx.category)
      ? { ...tx, category: "Revenu", category_id: undefined }
      : tx;
  }),
  savingsGoals: initialCache?.savingsGoals || [],
  debts: initialCache?.debts || [],

  initStore: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      activeUserId = user.id;
      set({ userId: user.id });
      const subscriptionPromise = get().refreshSubscription().catch(() => {});

      // Clean up legacy non-partitioned cache & migrate to user partition if needed
      if (typeof window !== "undefined") {
        try {
          const userKey = getStorageKey(user.id);
          if (!localStorage.getItem(userKey)) {
            const legacy = localStorage.getItem("monbudget_local_cache_v3");
            if (legacy) {
              localStorage.setItem(userKey, legacy);
            }
          }
          localStorage.removeItem("monbudget_local_cache_v3");
        } catch {}
      }

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
        let cur = profile.currency && profile.currency.trim() ? profile.currency.trim() : "FCFA";
        // Migration automatique des comptes avec devise historique EUR vers FCFA
        if (cur === "EUR" || cur === "€") {
          cur = "FCFA";
          supabase.from("profiles").update({ currency: "FCFA" }).eq("id", user.id).then();
        }
        const th = profile.alert_threshold_percent ? Number(profile.alert_threshold_percent) : 80;
        const pd = profile.pay_day ? Number(profile.pay_day) : 28;
        
        // Charger les préférences de notifications
        const remoteNotifs = profile.notifications || user.user_metadata?.notifications;
        const finalNotifs = remoteNotifs 
          ? { ...defaultNotifications, ...remoteNotifs } 
          : (get().notifications || defaultNotifications);

        set({ currency: cur, alertThreshold: th, payDay: pd, notifications: finalNotifs });

        const cache = loadLocalCache();
        if (cache) {
          cache.currency = cur;
          cache.notifications = finalNotifs;
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

        // 3. Revenus de base (multi-sources)
        const { data: incomes } = await supabase
          .from("income_entries")
          .select("*")
          .eq("monthly_budget_id", budget.id);

        const remoteIncomeEntries: IncomeSourceEntry[] = (incomes || []).map((inc) => ({
          id: inc.id,
          label: inc.label || "Salaire principal",
          sourceType: inc.source_type || "Salaire",
          amount: Number(inc.amount) || 0,
          date: inc.received_date || undefined,
        }));

        const fetchedBaseSalary = remoteIncomeEntries.reduce((sum, inc) => sum + inc.amount, 0);

        // 4. Catégories & Allocations
        let { data: allCategories } = await supabase
          .from("categories")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true);

        // Si l'utilisateur n'a aucune catégorie (nouveau compte inscrit ou profil sans catégories),
        // générer automatiquement les 11 catégories africaines par défaut avec prévisions à 0 FCFA
        if (!allCategories || allCategories.length === 0) {
          try {
            const defaultCatsToInsert = AFRICAN_EXPENSE_CATEGORIES.map((cat) => ({
              user_id: user.id,
              name: cat.name,
              color: cat.color,
              is_active: true,
            }));
            const { data: insertedCats } = await supabase
              .from("categories")
              .insert(defaultCatsToInsert)
              .select();
            if (insertedCats && insertedCats.length > 0) {
              allCategories = insertedCats;
            }
          } catch (catErr) {
            console.warn("Could not insert default categories into Supabase:", catErr);
          }
        }

        const effectiveCategoriesList = (allCategories && allCategories.length > 0)
          ? allCategories
          : AFRICAN_EXPENSE_CATEGORIES.map((cat, idx) => ({
              id: `cat-default-${idx}`,
              name: cat.name,
              color: cat.color,
              user_id: user.id,
              is_active: true,
            }));

        const { data: allocations } = await supabase
          .from("budget_allocations")
          .select("*")
          .eq("monthly_budget_id", budget.id);

        const rawCategories: Category[] = effectiveCategoriesList.map((cat: any) => {
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
          const desc = tx.description || (isInc ? "Revenu complémentaire" : "Dépense");
          const isDebtRepay = desc.startsWith("Remboursement dette :");
          const isDebtRecover = desc.startsWith("Remboursement reçu :");
          const isSavingsTx = desc.startsWith("Épargne :");
          return {
            id: tx.id,
            label: desc,
            amount: Number(tx.amount),
            category: isInc
              ? isDebtRecover
                ? "Recouvrement de créance"
                : tx.income_source || "Revenu"
              : tx.categories?.name ||
                (isDebtRepay
                  ? "Remboursement de dette"
                  : isSavingsTx
                  ? "Épargne"
                  : "Autre (Hors Budget)"),
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

        // FUSION RIGOUREUSE DES TRANSACTIONS : Préserver toutes les transactions locales
        const currentTxs = get().transactions;
        const mergedTxsMap = new Map<string, Transaction>();
        
        // 1. D'abord les transactions distantes
        for (const rTx of mappedTxs) {
          mergedTxsMap.set(rTx.id, rTx);
        }
        
        // 2. Ensuite les transactions locales qui ne sont pas encore dans Supabase
        for (const lTx of currentTxs) {
          const alreadyInRemote = mappedTxs.some(
            (r) => r.id === lTx.id || (r.date === lTx.date && r.amount === lTx.amount && r.label === lTx.label)
          );
          if (!alreadyInRemote) {
            mergedTxsMap.set(lTx.id, lTx);
            if (budget && user) {
              const isInc = lTx.type === "income" || lTx.type === "income_adjustment";
              supabase.from("transactions").insert({
                monthly_budget_id: budget.id,
                description: lTx.label,
                amount: lTx.amount,
                type: lTx.type,
                transaction_date: lTx.date || new Date().toISOString().split("T")[0],
                category_id: isInc ? null : lTx.category_id,
              }).then();
            }
          }
        }

        const finalTxs = Array.from(mergedTxsMap.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Calcul du revenu total : Salaire de base + revenus supplémentaires des transactions fusionnées
        const finalAdditionalIncomes = finalTxs
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0);

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

        // Pour le salaire & entrées de revenus : préserver la saisie locale si elle est > 0
        const localBaseSalary = get().baseSalary;
        const localIncomeEntries = get().incomeEntries;
        const finalIncomeEntries =
          remoteIncomeEntries.length > 0
            ? remoteIncomeEntries
            : localIncomeEntries.length > 0
            ? localIncomeEntries
            : localBaseSalary > 0
            ? [{ id: "local-salary", label: "Salaire principal", sourceType: "Salaire", amount: localBaseSalary }]
            : [];
        const finalBaseSalary = localBaseSalary > 0 ? localBaseSalary : (fetchedBaseSalary > 0 ? fetchedBaseSalary : 0);
        const finalIncome = finalBaseSalary + finalAdditionalIncomes;

        set({
          baseSalary: finalBaseSalary,
          income: finalIncome,
          incomeEntries: finalIncomeEntries,
          categories: finalCats,
          transactions: finalTxs,
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
        cache.subscriptionPlan = get().subscriptionPlan;
        cache.billingCycle = get().billingCycle;
        cache.subscriptionExpiresAt = get().subscriptionExpiresAt;
        cache.subscriptionStatus = get().subscriptionStatus;
        cache.months[monthKey] = {
          baseSalary: finalBaseSalary,
          income: finalIncome,
          incomeEntries: finalIncomeEntries,
          categories: finalCats,
          transactions: finalTxs,
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

      // Synchroniser automatiquement l'enveloppe Épargne dans Mon Budget si des épargnes existent sur le mois actif
      const activeGoals = get().savingsGoals;
      const monthlySavingsAmount = getMonthlySavingsContributions(activeGoals, year, month);
      const txSavingsAmount = getSpentByCategory(get().transactions, "Épargne", monthlySavingsAmount);
      const effectiveMonthlySavings = Math.max(monthlySavingsAmount, txSavingsAmount);
      if (effectiveMonthlySavings > 0) {
        const currentCats = get().categories;
        const hasSavingsCat = currentCats.some(
          (c) => c.name.trim().toLowerCase() === "épargne" || c.name.trim().toLowerCase() === "epargne"
        );
        let syncedSavingsCats = currentCats;
        if (!hasSavingsCat) {
          const newSavCat: Category = {
            id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cat-sav-${Date.now()}`,
            name: "Épargne",
            amount: effectiveMonthlySavings,
            color: "bg-emerald-600",
          };
          syncedSavingsCats = deduplicateCategories([...currentCats, newSavCat]);
        } else {
          syncedSavingsCats = currentCats.map((c) => {
            const norm = c.name.trim().toLowerCase();
            if (norm === "épargne" || norm === "epargne") {
              return { ...c, amount: Math.max(Number(c.amount) || 0, effectiveMonthlySavings) };
            }
            return c;
          });
        }
        set({ categories: syncedSavingsCats });
        const cacheAfterSavings = loadLocalCache();
        if (cacheAfterSavings && cacheAfterSavings.months[monthKey]) {
          cacheAfterSavings.months[monthKey].categories = syncedSavingsCats;
          saveLocalCache(cacheAfterSavings);
        }
      }

      // 7. Dettes & Créances
      try {
        const { data: remoteDebts } = await supabase
          .from("debts")
          .select("*, debt_payments(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (remoteDebts && remoteDebts.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedDebts: DebtItem[] = remoteDebts.map((d: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payments: DebtPaymentItem[] = (d.debt_payments || []).map((p: any) => ({
              id: p.id,
              amount: Number(p.amount),
              date: p.payment_date,
              notes: p.notes || undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const sumPaid = payments.reduce((s, p) => s + p.amount, 0);
            const totalAmt = Number(d.total_amount) || 0;
            const remainingAmt = payments.length > 0 ? Math.max(0, totalAmt - sumPaid) : Number(d.remaining_amount ?? totalAmt);

            return {
              id: d.id,
              type: (d.type === "receivable" ? "receivable" : "payable") as "payable" | "receivable",
              personName: d.person_name,
              phone: d.phone || undefined,
              totalAmount: totalAmt,
              remainingAmount: remainingAmt,
              dueDate: d.due_date || undefined,
              status: remainingAmt <= 0 ? "paid" : sumPaid > 0 ? "partial" : (d.status || "pending"),
              notes: d.notes || undefined,
              payments,
              createdAt: d.created_at,
            };
          });
          set({ debts: mappedDebts });
          const cache = loadLocalCache();
          if (cache) {
            cache.debts = mappedDebts;
            saveLocalCache(cache);
          }
        }
      } catch {
        // La table debts peut ne pas encore être créée sur Supabase ; on garde les dettes locales
      }

      // 8. Abonnement SaaS Moneriz & statut admin (lecture serveur)
      await subscriptionPromise;
    } catch (e) {
      console.warn("Notice: Offline or local mode active", e);
    }
  },

  updatePreferences: async (prefs) => {
    const newCurrency = prefs.currency !== undefined ? (prefs.currency.trim() || "FCFA") : get().currency;
    const newAlert = prefs.alertThreshold ?? get().alertThreshold;
    const newPayDay = prefs.payDay ?? get().payDay;
    const newNotifications = prefs.notifications 
      ? { ...get().notifications, ...prefs.notifications }
      : get().notifications;

    set({
      alertThreshold: newAlert,
      currency: newCurrency,
      payDay: newPayDay,
      notifications: newNotifications,
    });

    // Sauvegarde locale instantanée
    const cache = loadLocalCache() || {
      currency: newCurrency,
      payDay: newPayDay,
      alertThreshold: newAlert,
      notifications: newNotifications,
      months: {},
      savingsGoals: get().savingsGoals,
    };
    cache.currency = newCurrency;
    cache.alertThreshold = newAlert;
    cache.payDay = newPayDay;
    cache.notifications = newNotifications;
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
      }

      // Synchronisation auth user metadata pour persistance garantie
      await supabase.auth.updateUser({
        data: {
          ...(prefs.fullName ? { full_name: prefs.fullName } : {}),
          notifications: newNotifications,
        }
      });

      // Synchronisation table profiles
      try {
        await supabase.from("profiles").update({
          ...updates,
          notifications: newNotifications,
        }).eq("id", user.id);
      } catch {
        if (Object.keys(updates).length > 0) {
          await supabase.from("profiles").update(updates).eq("id", user.id);
        }
      }
    } catch (err) {
      console.warn("Could not sync preferences to Supabase", err);
    }
  },

  updateNotifications: async (notifs) => {
    await get().updatePreferences({ notifications: notifs });
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

  addIncomeEntry: async (entry) => {
    const cleanAmount = Math.max(0, Number(entry.amount) || 0);
    if (cleanAmount <= 0) return;

    const newItem: IncomeSourceEntry = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      label: entry.label.trim() || entry.sourceType || "Revenu",
      sourceType: entry.sourceType || "Salaire",
      amount: cleanAmount,
      date: entry.date || new Date().toISOString().split("T")[0],
    };

    const currentEntries = get().incomeEntries;
    // Si aucune entrée mais baseSalary > 0, convertir d'abord baseSalary en entrée initiale
    const baseEntries: IncomeSourceEntry[] =
      currentEntries.length === 0 && get().baseSalary > 0
        ? [{ id: "initial-salary", label: "Salaire principal", sourceType: "Salaire", amount: get().baseSalary }]
        : currentEntries;

    const updatedEntries = [...baseEntries, newItem];
    const newBaseSalary = updatedEntries.reduce((sum, item) => sum + item.amount, 0);
    const additionalIncomes = get().transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = newBaseSalary + additionalIncomes;

    set({
      incomeEntries: updatedEntries,
      baseSalary: newBaseSalary,
      income: totalIncome,
    });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache() || {
      currency: get().currency,
      payDay: get().payDay,
      alertThreshold: get().alertThreshold,
      months: {},
      savingsGoals: get().savingsGoals,
      debts: get().debts,
    };
    cache.months[monthKey] = {
      baseSalary: newBaseSalary,
      income: totalIncome,
      incomeEntries: updatedEntries,
      categories: get().categories,
      transactions: get().transactions,
    };
    saveLocalCache(cache);

    try {
      const budgetId = get().budget_id;
      if (!budgetId) return;
      const { data: created } = await supabase
        .from("income_entries")
        .insert({
          monthly_budget_id: budgetId,
          label: newItem.label,
          source_type: newItem.sourceType,
          amount: newItem.amount,
          received_date: newItem.date,
        })
        .select()
        .maybeSingle();

      if (created) {
        newItem.id = created.id;
      }
    } catch {
      // Fallback sans source_type si la colonne n'est pas encore créée
      try {
        const budgetId = get().budget_id;
        if (!budgetId) return;
        await supabase.from("income_entries").insert({
          monthly_budget_id: budgetId,
          label: `${newItem.sourceType} - ${newItem.label}`,
          amount: newItem.amount,
          received_date: newItem.date,
        });
      } catch (e) {
        console.warn("Could not sync income entry to Supabase", e);
      }
    }
  },

  removeIncomeEntry: async (id) => {
    const updatedEntries = get().incomeEntries.filter((e) => e.id !== id);
    const newBaseSalary = updatedEntries.reduce((sum, item) => sum + item.amount, 0);
    const additionalIncomes = get().transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = newBaseSalary + additionalIncomes;

    set({
      incomeEntries: updatedEntries,
      baseSalary: newBaseSalary,
      income: totalIncome,
    });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].incomeEntries = updatedEntries;
      cache.months[monthKey].baseSalary = newBaseSalary;
      cache.months[monthKey].income = totalIncome;
      saveLocalCache(cache);
    }

    try {
      await supabase.from("income_entries").delete().eq("id", id);
    } catch (err) {
      console.warn("Could not delete income entry from Supabase", err);
    }
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
        if (!get().isOnline) {
          throw new Error("Mode hors-ligne");
        }
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
        console.warn("Could not sync allocation to Supabase (queued)", err);
        const budgetId = get().budget_id;
        const category = get().categories.find((c) => c.id === id);
        get().enqueueSyncAction({
          type: "update_category_amount",
          payload: {
            allocation_id: category?.allocation_id,
            budgetId,
            categoryId: id,
            amount,
          },
        });
      }
    }, 600);
  },

  addTransaction: async (tx) => {
    const isInc = tx.type === "income" || tx.type === "income_adjustment";
    const normalizedType: "income" | "expense" = isInc ? "income" : "expense";
    const assignedCatName = (tx.category || (isInc ? "Revenu" : "Autre (Hors Budget)")).trim();
    const transactionItem: Transaction = {
      ...tx,
      type: normalizedType,
      category: assignedCatName,
    };

    const newTransactions = [transactionItem, ...get().transactions];
    const newIncome = isInc ? get().income + tx.amount : get().income;

    // Si c'est une dépense sur une catégorie qui n'est pas encore dans Mon Budget, l'ajouter automatiquement à Mon Budget
    // Et si c'est une épargne (ou non budgétisé), comptabiliser automatiquement le montant dans l'enveloppe
    let updatedCategories = get().categories;
    const isSavingsCat =
      assignedCatName.toLowerCase() === "épargne" ||
      assignedCatName.toLowerCase() === "epargne" ||
      tx.label.trim().toLowerCase().startsWith("épargne :");

    if (!isInc && assignedCatName && assignedCatName !== "Autre (Hors Budget)") {
      const catSpentAfter = getSpentByCategory(newTransactions, assignedCatName);
      const catExists = updatedCategories.some(
        (c) => c.name.trim().toLowerCase() === assignedCatName.toLowerCase()
      );
      if (!catExists) {
        const newCatId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `cat-${Date.now()}`;
        const newCat: Category = {
          id: newCatId,
          name: assignedCatName,
          amount: isSavingsCat ? catSpentAfter : 0,
          color: isSavingsCat ? "bg-emerald-600" : "bg-blue-500",
        };
        updatedCategories = deduplicateCategories([...updatedCategories, newCat]);
      } else if (isSavingsCat) {
        updatedCategories = updatedCategories.map((c) => {
          if (c.name.trim().toLowerCase() === assignedCatName.toLowerCase()) {
            return { ...c, amount: Math.max(Number(c.amount) || 0, catSpentAfter) };
          }
          return c;
        });
      }
    }

    set({
      transactions: newTransactions,
      income: newIncome,
      categories: updatedCategories,
    });

    // Sauvegarde locale instantanée
    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].transactions = newTransactions;
      cache.months[monthKey].income = newIncome;
      cache.months[monthKey].categories = updatedCategories;
      saveLocalCache(cache);
    }

    try {
      if (!get().isOnline) {
        throw new Error("Mode hors-ligne");
      }
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
      console.warn("Could not sync transaction to Supabase immediately (queued)", err);
      let category_id = null;
      if (!isInc) {
        const cat = get().categories.find((c) => c.name.toLowerCase() === tx.category.toLowerCase());
        if (cat) category_id = cat.id;
      }
      get().enqueueSyncAction({
        type: "add_transaction",
        payload: {
          monthly_budget_id: get().budget_id,
          category_id,
          amount: tx.amount,
          description: tx.label,
          transaction_date: tx.date,
          type: isInc ? "income_adjustment" : "expense",
        },
      });
    }
  },

  removeTransaction: async (id) => {
    const tx = get().transactions.find((t) => t.id === id);
    const newTransactions = get().transactions.filter((t) => t.id !== id);
    let newIncome = get().income;
    if (tx && (tx.type === "income" || tx.type === "income_adjustment")) {
      newIncome = Math.max(0, newIncome - tx.amount);
    }

    // Si cette transaction provenait d'un remboursement de dette/créance, synchroniser la dette automatiquement
    let updatedDebts = get().debts;
    let syncedPaymentIdToRemove: string | null = null;
    let syncedDebtToUpdate: DebtItem | null = null;

    if (tx) {
      const isDebtTx =
        tx.linkedPaymentId ||
        tx.label.startsWith("Remboursement dette :") ||
        tx.label.startsWith("Remboursement reçu :");
      if (isDebtTx) {
        updatedDebts = get().debts.map((d) => {
          const matchingPayment = (d.payments || []).find(
            (p) =>
              (tx.linkedPaymentId && p.id === tx.linkedPaymentId) ||
              p.linkedTransactionId === tx.id ||
              (tx.label.includes(d.personName) && p.amount === tx.amount && p.date === tx.date)
          );
          if (!matchingPayment) return d;
          syncedPaymentIdToRemove = matchingPayment.id;
          const filteredPayments = (d.payments || []).filter((p) => p.id !== matchingPayment.id);
          const totalPaid = filteredPayments.reduce((s, p) => s + p.amount, 0);
          const newRemaining = Math.max(0, d.totalAmount - totalPaid);
          const newStatus: "pending" | "partial" | "paid" =
            newRemaining <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";
          const updatedD = {
            ...d,
            remainingAmount: newRemaining,
            status: newStatus,
            payments: filteredPayments,
          };
          syncedDebtToUpdate = updatedD;
          return updatedD;
        });
      }
      // Si cette transaction provenait d'un versement d'épargne, synchroniser automatiquement l'objectif d'épargne
      const isSavingsTx =
        tx.linkedContributionId ||
        tx.label.startsWith("Épargne :") ||
        tx.category.trim().toLowerCase() === "épargne";
      let updatedGoals = get().savingsGoals;
      let syncedContribIdToRemove: string | null = null;
      let syncedGoalToUpdate: SavingsGoal | null = null;

      let updatedCategories = get().categories;
      if (isSavingsTx) {
        const { year: curYear, month: curMonth } = get().activeMonth;
        const prevMonthlySav = Math.max(
          getMonthlySavingsContributions(get().savingsGoals, curYear, curMonth),
          getSpentByCategory(get().transactions, "Épargne")
        );
        updatedGoals = get().savingsGoals.map((g) => {
          const matchingContrib = (g.contributions || []).find(
            (c) =>
              (tx.linkedContributionId && c.id === tx.linkedContributionId) ||
              c.linkedTransactionId === tx.id ||
              (tx.label.includes(g.name) && c.amount === tx.amount && c.date === tx.date)
          );
          if (!matchingContrib) return g;
          syncedContribIdToRemove = matchingContrib.id;
          const filteredContribs = (g.contributions || []).filter((c) => c.id !== matchingContrib.id);
          const newCurrent = filteredContribs.reduce((s, c) => s + c.amount, 0);
          const newStatus: "active" | "completed" | "paused" =
            newCurrent >= g.target ? "completed" : "active";
          const updatedG: SavingsGoal = {
            ...g,
            current: newCurrent,
            status: newStatus,
            contributions: filteredContribs,
          };
          syncedGoalToUpdate = updatedG;
          return updatedG;
        });

        const newMonthlySav = Math.max(
          getMonthlySavingsContributions(updatedGoals, curYear, curMonth),
          getSpentByCategory(newTransactions, "Épargne")
        );
        updatedCategories = updatedCategories.map((c) => {
          const norm = c.name.trim().toLowerCase();
          if ((norm === "épargne" || norm === "epargne") && (Number(c.amount) || 0) <= prevMonthlySav) {
            return { ...c, amount: newMonthlySav };
          }
          return c;
        });
      }

      set({
        transactions: newTransactions,
        income: newIncome,
        debts: updatedDebts,
        savingsGoals: updatedGoals,
        categories: updatedCategories,
      });

      const { year, month } = get().activeMonth;
      const monthKey = getMonthKey(year, month);
      const cache = loadLocalCache();
      if (cache) {
        if (cache.months[monthKey]) {
          cache.months[monthKey].transactions = newTransactions;
          cache.months[monthKey].income = newIncome;
          cache.months[monthKey].categories = updatedCategories;
        }
        cache.debts = updatedDebts;
        cache.savingsGoals = updatedGoals;
        saveLocalCache(cache);
      }

      try {
        if (!get().isOnline) throw new Error("Mode hors-ligne");
        await supabase.from("transactions").delete().eq("id", id);
        if (syncedPaymentIdToRemove && syncedDebtToUpdate) {
          const dUpd = syncedDebtToUpdate as DebtItem;
          await supabase.from("debt_payments").delete().eq("id", syncedPaymentIdToRemove);
          await supabase
            .from("debts")
            .update({ remaining_amount: dUpd.remainingAmount, status: dUpd.status })
            .eq("id", dUpd.id);
        }
        if (syncedContribIdToRemove && syncedGoalToUpdate) {
          const gUpd = syncedGoalToUpdate as SavingsGoal;
          await supabase.from("savings_contributions").delete().eq("id", syncedContribIdToRemove);
          await supabase
            .from("savings_goals")
            .update({ current_amount: gUpd.current, status: gUpd.status })
            .eq("id", gUpd.id);
        }
      } catch (err) {
        console.warn("Could not delete transaction from Supabase immediately (queued)", err);
        get().enqueueSyncAction({
          type: "remove_transaction",
          payload: { id },
        });
      }
      return;
    }

    set({
      transactions: newTransactions,
      income: newIncome,
      debts: updatedDebts,
    });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache) {
      if (cache.months[monthKey]) {
        cache.months[monthKey].transactions = newTransactions;
        cache.months[monthKey].income = newIncome;
      }
      cache.debts = updatedDebts;
      saveLocalCache(cache);
    }

    try {
      if (!get().isOnline) throw new Error("Mode hors-ligne");
      await supabase.from("transactions").delete().eq("id", id);
      if (syncedPaymentIdToRemove && syncedDebtToUpdate) {
        const dUpd = syncedDebtToUpdate as DebtItem;
        await supabase.from("debt_payments").delete().eq("id", syncedPaymentIdToRemove);
        await supabase
          .from("debts")
          .update({ remaining_amount: dUpd.remainingAmount, status: dUpd.status })
          .eq("id", dUpd.id);
      }
    } catch (err) {
      console.warn("Could not delete transaction from Supabase immediately (queued)", err);
      get().enqueueSyncAction({
        type: "remove_transaction",
        payload: { id },
      });
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
    const txId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `tx-sav-${Date.now()}`;
    const contribItem: SavingsContribution = {
      id: Date.now().toString(),
      amount,
      date: contributionDate,
      notes: notes || undefined,
      linkedTransactionId: txId,
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

    // Créer automatiquement la transaction liée pour que Transactions et Mon Budget soient synchronisés
    const txLabel = `Épargne : ${goal.name}${notes?.trim() ? ` (${notes.trim()})` : ""}`;
    const linkedTx: Transaction = {
      id: txId,
      label: txLabel,
      amount,
      category: "Épargne",
      date: contributionDate,
      type: "expense",
      linkedSavingsGoalId: goalId,
      linkedContributionId: contribItem.id,
    };

    const updatedTransactions = [linkedTx, ...get().transactions];

    // Comptabiliser automatiquement l'épargne dans Mon Budget même si elle n'était pas budgétisée
    const { year, month } = get().activeMonth;
    const monthlySavingsTotal = Math.max(
      getMonthlySavingsContributions(updatedGoals, year, month),
      getSpentByCategory(updatedTransactions, "Épargne")
    );

    let updatedCategories = get().categories;
    const hasSavingsCat = updatedCategories.some(
      (c) => c.name.trim().toLowerCase() === "épargne" || c.name.trim().toLowerCase() === "epargne"
    );

    if (!hasSavingsCat) {
      const newSavCat: Category = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `cat-sav-${Date.now()}`,
        name: "Épargne",
        amount: monthlySavingsTotal,
        color: "bg-emerald-600",
      };
      updatedCategories = deduplicateCategories([...updatedCategories, newSavCat]);
    } else {
      updatedCategories = updatedCategories.map((c) => {
        const norm = c.name.trim().toLowerCase();
        if (norm === "épargne" || norm === "epargne") {
          return { ...c, amount: Math.max(Number(c.amount) || 0, monthlySavingsTotal) };
        }
        return c;
      });
    }

    set({
      savingsGoals: updatedGoals,
      transactions: updatedTransactions,
      categories: updatedCategories,
    });

    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache) {
      cache.savingsGoals = updatedGoals;
      if (cache.months[monthKey]) {
        cache.months[monthKey].transactions = updatedTransactions;
        cache.months[monthKey].categories = updatedCategories;
      }
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
        linkedTx.linkedContributionId = newContrib.id;
      }
      await supabase.from("savings_goals").update({ current_amount: newCurrent }).eq("id", goalId);

      const budgetId = get().budget_id;
      if (budgetId) {
        const { data: createdTx } = await supabase
          .from("transactions")
          .insert({
            monthly_budget_id: budgetId,
            category_id: null,
            amount,
            description: txLabel,
            transaction_date: contributionDate,
            type: "expense",
          })
          .select()
          .maybeSingle();

        if (createdTx) {
          linkedTx.id = createdTx.id;
          contribItem.linkedTransactionId = createdTx.id;
        }
      }
    } catch (err) {
      console.warn("Could not sync savings contribution to Supabase", err);
    }
  },

  removeSavingsContribution: async (contributionId, goalId) => {
    const targetGoal = get().savingsGoals.find((g) => g.id === goalId);
    const contribToRemove = targetGoal?.contributions?.find((c) => c.id === contributionId);

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

    // Supprimer automatiquement la transaction liée dans Transactions
    let txToRemoveId: string | null = null;
    const currentTxs = get().transactions;
    const matchingTx = currentTxs.find(
      (t) =>
        t.linkedContributionId === contributionId ||
        (contribToRemove?.linkedTransactionId && t.id === contribToRemove.linkedTransactionId) ||
        (targetGoal &&
          contribToRemove &&
          t.amount === contribToRemove.amount &&
          t.date === contribToRemove.date &&
          t.label.includes(targetGoal.name))
    );

    const updatedTransactions = matchingTx
      ? currentTxs.filter((t) => t.id !== matchingTx.id)
      : currentTxs;
    if (matchingTx) {
      txToRemoveId = matchingTx.id;
    }

    const { year, month } = get().activeMonth;
    const prevMonthlySav = Math.max(
      getMonthlySavingsContributions(get().savingsGoals, year, month),
      getSpentByCategory(get().transactions, "Épargne")
    );
    const newMonthlySav = Math.max(
      getMonthlySavingsContributions(updatedGoals, year, month),
      getSpentByCategory(updatedTransactions, "Épargne")
    );

    const updatedCategories = get().categories.map((c) => {
      const norm = c.name.trim().toLowerCase();
      if ((norm === "épargne" || norm === "epargne") && (Number(c.amount) || 0) <= prevMonthlySav) {
        return { ...c, amount: newMonthlySav };
      }
      return c;
    });

    set({
      savingsGoals: updatedGoals,
      transactions: updatedTransactions,
      categories: updatedCategories,
    });

    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache) {
      cache.savingsGoals = updatedGoals;
      if (cache.months[monthKey]) {
        cache.months[monthKey].transactions = updatedTransactions;
        cache.months[monthKey].categories = updatedCategories;
      }
      saveLocalCache(cache);
    }

    try {
      await supabase.from("savings_contributions").delete().eq("id", contributionId);
      const updatedGoal = updatedGoals.find((g) => g.id === goalId);
      if (updatedGoal) {
        await supabase
          .from("savings_goals")
          .update({ current_amount: updatedGoal.current, status: updatedGoal.status })
          .eq("id", goalId);
      }
      if (txToRemoveId) {
        await supabase.from("transactions").delete().eq("id", txToRemoveId);
      }
    } catch (err) {
      console.warn("Could not delete savings contribution from Supabase", err);
    }
  },

  addSavingsAmount: async (id, amount) => {
    await get().addSavingsContribution(id, amount);
  },

  addDebt: async (debt) => {
    const cleanAmount = Math.max(0, Number(debt.totalAmount) || 0);
    if (!debt.personName.trim() || cleanAmount <= 0) return;

    const newDebt: DebtItem = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      type: debt.type,
      personName: debt.personName.trim(),
      phone: debt.phone?.trim() || undefined,
      totalAmount: cleanAmount,
      remainingAmount: cleanAmount,
      dueDate: debt.dueDate || undefined,
      status: "pending",
      notes: debt.notes?.trim() || undefined,
      payments: [],
      createdAt: new Date().toISOString(),
    };

    const updatedDebts = [newDebt, ...get().debts];
    set({ debts: updatedDebts });

    const cache = loadLocalCache() || {
      currency: get().currency,
      payDay: get().payDay,
      alertThreshold: get().alertThreshold,
      months: {},
      savingsGoals: get().savingsGoals,
      debts: updatedDebts,
    };
    cache.debts = updatedDebts;
    saveLocalCache(cache);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: created } = await supabase
        .from("debts")
        .insert({
          user_id: user.id,
          type: newDebt.type,
          person_name: newDebt.personName,
          phone: newDebt.phone || null,
          total_amount: newDebt.totalAmount,
          remaining_amount: newDebt.remainingAmount,
          due_date: newDebt.dueDate || null,
          status: "pending",
          notes: newDebt.notes || null,
        })
        .select()
        .maybeSingle();

      if (created) {
        newDebt.id = created.id;
      }
    } catch (err) {
      console.warn("Could not sync debt to Supabase", err);
    }
  },

  removeDebt: async (id) => {
    const updatedDebts = get().debts.filter((d) => d.id !== id);
    set({ debts: updatedDebts });

    const cache = loadLocalCache();
    if (cache) {
      cache.debts = updatedDebts;
      saveLocalCache(cache);
    }

    try {
      await supabase.from("debts").delete().eq("id", id);
    } catch (err) {
      console.warn("Could not delete debt from Supabase", err);
    }
  },

  addDebtPayment: async (debtId, amount, notes, date) => {
    const debt = get().debts.find((d) => d.id === debtId);
    if (!debt) return;

    const cleanAmount = Math.max(0, Number(amount) || 0);
    if (cleanAmount <= 0) return;

    const paymentDate = date || new Date().toISOString().split("T")[0];
    const txId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}`;
    const paymentItem: DebtPaymentItem = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      amount: cleanAmount,
      date: paymentDate,
      notes: notes?.trim() || undefined,
      linkedTransactionId: txId,
    };

    const newRemaining = Math.max(0, debt.remainingAmount - cleanAmount);
    const newStatus: "pending" | "partial" | "paid" =
      newRemaining <= 0 ? "paid" : newRemaining < debt.totalAmount ? "partial" : "pending";

    const updatedDebts = get().debts.map((d) => {
      if (d.id !== debtId) return d;
      return {
        ...d,
        remainingAmount: newRemaining,
        status: newStatus,
        payments: [paymentItem, ...(d.payments || [])],
      };
    });

    // Répercussion automatique sur les Transactions, Revenus/Dépenses et Solde disponible
    const isReceivable = debt.type === "receivable";
    const txLabel = isReceivable
      ? `Remboursement reçu : ${debt.personName}${notes?.trim() ? ` (${notes.trim()})` : ""}`
      : `Remboursement dette : ${debt.personName}${notes?.trim() ? ` (${notes.trim()})` : ""}`;

    const linkedTx: Transaction = {
      id: txId,
      label: txLabel,
      amount: cleanAmount,
      category: isReceivable ? "Recouvrement de créance" : "Remboursement de dette",
      date: paymentDate,
      type: isReceivable ? "income" : "expense",
      linkedDebtId: debtId,
      linkedPaymentId: paymentItem.id,
    };

    const updatedTransactions = [linkedTx, ...get().transactions];
    const updatedIncome = isReceivable ? get().income + cleanAmount : get().income;

    set({
      debts: updatedDebts,
      transactions: updatedTransactions,
      income: updatedIncome,
    });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache() || {
      currency: get().currency,
      payDay: get().payDay,
      alertThreshold: get().alertThreshold,
      months: {},
      savingsGoals: get().savingsGoals,
      debts: updatedDebts,
    };
    cache.debts = updatedDebts;
    if (!cache.months[monthKey]) {
      cache.months[monthKey] = {
        baseSalary: get().baseSalary,
        income: updatedIncome,
        incomeEntries: get().incomeEntries,
        categories: get().categories,
        transactions: updatedTransactions,
      };
    } else {
      cache.months[monthKey].transactions = updatedTransactions;
      cache.months[monthKey].income = updatedIncome;
    }
    saveLocalCache(cache);

    try {
      const { data: createdPayment } = await supabase
        .from("debt_payments")
        .insert({
          debt_id: debtId,
          amount: cleanAmount,
          payment_date: paymentDate,
          notes: notes?.trim() || null,
        })
        .select()
        .maybeSingle();

      if (createdPayment) {
        paymentItem.id = createdPayment.id;
        linkedTx.linkedPaymentId = createdPayment.id;
      }

      await supabase
        .from("debts")
        .update({ remaining_amount: newRemaining, status: newStatus })
        .eq("id", debtId);

      // Synchroniser également la transaction liée dans Supabase
      const budgetId = get().budget_id;
      if (budgetId) {
        const { data: createdTx } = await supabase
          .from("transactions")
          .insert({
            monthly_budget_id: budgetId,
            category_id: null,
            amount: cleanAmount,
            description: txLabel,
            transaction_date: paymentDate,
            type: isReceivable ? "income_adjustment" : "expense",
          })
          .select()
          .maybeSingle();

        if (createdTx) {
          linkedTx.id = createdTx.id;
          paymentItem.linkedTransactionId = createdTx.id;
        }
      }
    } catch (err) {
      console.warn("Could not sync debt payment to Supabase", err);
    }
  },

  removeDebtPayment: async (paymentId, debtId) => {
    const targetDebt = get().debts.find((d) => d.id === debtId);
    const paymentToRemove = targetDebt?.payments?.find((p) => p.id === paymentId);

    const updatedDebts = get().debts.map((d) => {
      if (d.id !== debtId) return d;
      const filtered = (d.payments || []).filter((p) => p.id !== paymentId);
      const totalPaid = filtered.reduce((s, p) => s + p.amount, 0);
      const newRemaining = Math.max(0, d.totalAmount - totalPaid);
      const newStatus: "pending" | "partial" | "paid" =
        newRemaining <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";
      return {
        ...d,
        remainingAmount: newRemaining,
        status: newStatus,
        payments: filtered,
      };
    });

    // Supprimer automatiquement la transaction liée et réajuster le revenu / solde
    let txToRemoveId: string | null = null;
    const currentTxs = get().transactions;
    const matchingTx = currentTxs.find(
      (t) =>
        t.linkedPaymentId === paymentId ||
        (paymentToRemove?.linkedTransactionId && t.id === paymentToRemove.linkedTransactionId) ||
        (targetDebt &&
          paymentToRemove &&
          t.amount === paymentToRemove.amount &&
          t.date === paymentToRemove.date &&
          t.label.includes(targetDebt.personName))
    );

    let updatedTransactions = currentTxs;
    let updatedIncome = get().income;

    if (matchingTx) {
      txToRemoveId = matchingTx.id;
      updatedTransactions = currentTxs.filter((t) => t.id !== matchingTx.id);
      if (matchingTx.type === "income" || matchingTx.type === "income_adjustment") {
        updatedIncome = Math.max(0, updatedIncome - matchingTx.amount);
      }
    }

    set({
      debts: updatedDebts,
      transactions: updatedTransactions,
      income: updatedIncome,
    });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache) {
      cache.debts = updatedDebts;
      if (cache.months[monthKey]) {
        cache.months[monthKey].transactions = updatedTransactions;
        cache.months[monthKey].income = updatedIncome;
      }
      saveLocalCache(cache);
    }

    try {
      await supabase.from("debt_payments").delete().eq("id", paymentId);
      const updatedDebt = updatedDebts.find((d) => d.id === debtId);
      if (updatedDebt) {
        await supabase
          .from("debts")
          .update({ remaining_amount: updatedDebt.remainingAmount, status: updatedDebt.status })
          .eq("id", debtId);
      }
      if (txToRemoveId) {
        await supabase.from("transactions").delete().eq("id", txToRemoveId);
      }
    } catch (err) {
      console.warn("Could not delete debt payment from Supabase", err);
    }
  },
}));
