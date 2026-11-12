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
  getSubscriptionCountdownInfo,
  SubscriptionPlanId,
  SubscriptionStatus,
} from "@/lib/moneriz-plans";
import {
  appendOfflineAuditLog,
  clearOutboxEntriesForEntity,
  closeAndDeleteUserOfflineDb,
  ConflictRecord,
  enqueueOutboxEntry,
  exportOfflineBackupPackage,
  listOutboxEntries,
  listSyncConflicts,
  OFFLINE_DB_SCHEMA_VERSION,
  readOfflineSnapshot,
  resolveSyncConflict,
  verifyAndRestoreOfflineBackupPackage,
  writeOfflineSnapshot,
} from "@/lib/offline/db";
import {
  checkServerReachability,
  ensureValidUuid,
  migrateLegacyCacheToIndexedDb,
  processOutboxQueue,
  reconcileRecordsWithConflictDetection,
  requestBackgroundSync,
  SyncEngineState,
} from "@/lib/offline/sync-engine";

export type InAppNotificationType =
  | "welcome_trial"
  | "trial_reminder_3d"
  | "trial_expired"
  | "payment_success"
  | "renewal_reminder_3d"
  | "subscription_expired"
  | "system";

export interface InAppNotificationItem {
  id: string;
  userId: string;
  type: InAppNotificationType;
  title: string;
  message: string;
  ctaHref: string | null;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

const LOCKED_FEATURE_TOAST =
  "Fonctionnalité cadenassée — Passez au plan Particulier à 500 FCFA/mois pour la débloquer.";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  pendingSync?: boolean;
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
  budgetId?: string | null;
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
  subscriptionTrialEndsAt?: string | null;
  trialChoiceMadeAt?: string | null;
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
  syncStatus: SyncEngineState;
  pendingSyncCount: number;
  pendingEntityIds: string[];
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  unresolvedConflictsCount: number;
  syncConflicts: ConflictRecord[];
  canInstallPwa: boolean;
  isPwaInstalled: boolean;
  setOnlineStatus: (online: boolean) => void;
  setDeferredPrompt: (prompt: any) => void;
  setAppInstalled: () => void;
  installPwa: () => Promise<boolean>;
  syncPendingQueue: (force?: boolean, quietIfSingle?: boolean) => Promise<number>;
  enqueueSyncAction: (action: Omit<PendingSyncAction, "id" | "timestamp">) => void;
  refreshOfflineDiagnostics: () => Promise<void>;
  resolveConflictChoice: (
    conflictId: string,
    choice: "keep_local" | "keep_remote" | "dismiss"
  ) => Promise<void>;
  exportOfflineBackup: () => Promise<void>;
  restoreOfflineBackup: (jsonText: string) => Promise<{ ok: boolean; error?: string }>;

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

  // Abonnement SaaS (Moneriz), Essai 30j & Notifications (évalué côté serveur uniquement)
  isAdminUser: boolean;
  subscriptionHydrated: boolean;
  subscriptionPlan: SubscriptionPlanId;
  billingCycle: BillingCycle | "none";
  subscriptionExpiresAt: string | null;
  subscriptionTrialEndsAt: string | null;
  trialChoiceMadeAt: string | null;
  subscriptionStatus: SubscriptionStatus;
  refreshSubscription: (orderId?: string | null, paymentId?: string | null) => Promise<{
    planId: SubscriptionPlanId;
    orderStatus: string | null;
    isAdmin: boolean;
  }>;
  chooseFreePlan: () => Promise<boolean>;

  inAppNotifications: InAppNotificationItem[];
  unreadNotificationsCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: (opts: { notificationId?: string; markAll?: boolean }) => Promise<void>;

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
  const effectiveUid = uid ?? activeUserId;
  try {
    const key = getStorageKey(effectiveUid);
    localStorage.setItem(key, JSON.stringify(cache));
  } catch (err) {
    console.warn("Could not save to localStorage", err);
  }
  if (effectiveUid) {
    const monthsRecord: Record<
      string,
      {
        monthKey: string;
        baseSalary: number;
        income: number;
        incomeEntries?: IncomeSourceEntry[];
        categories: Category[];
        transactions: Transaction[];
        updatedAt?: string;
      }
    > = {};
    for (const [mKey, mVal] of Object.entries(cache.months || {})) {
      monthsRecord[mKey] = {
        monthKey: mKey,
        baseSalary: mVal.baseSalary,
        income: mVal.income,
        incomeEntries: mVal.incomeEntries,
        categories: mVal.categories,
        transactions: mVal.transactions,
      };
    }
    void writeOfflineSnapshot(effectiveUid, {
      schemaVersion: OFFLINE_DB_SCHEMA_VERSION,
      userId: effectiveUid,
      currency: cache.currency || "FCFA",
      payDay: cache.payDay || 28,
      alertThreshold: cache.alertThreshold || 80,
      fullName: cache.fullName,
      notifications: cache.notifications,
      months: monthsRecord,
      savingsGoals: cache.savingsGoals || [],
      debts: cache.debts || [],
      subscriptionPlan: cache.subscriptionPlan,
      billingCycle: cache.billingCycle,
      subscriptionExpiresAt: cache.subscriptionExpiresAt ?? null,
      subscriptionTrialEndsAt: cache.subscriptionTrialEndsAt ?? null,
      trialChoiceMadeAt: cache.trialChoiceMadeAt ?? null,
      subscriptionStatus: cache.subscriptionStatus,
      updatedAt: new Date().toISOString(),
    });
  }
}

// Hydratation initiale synchrone
const initialCache = loadLocalCache();
const initialMonthKey = getMonthKey(currentDate.getFullYear(), currentDate.getMonth() + 1);
const initialMonthData = initialCache?.months?.[initialMonthKey];

// Debounce timers pour la saisie sans lag
const allocationDebounceTimers: Record<string, NodeJS.Timeout> = {};
let incomeDebounceTimer: NodeJS.Timeout | null = null;

function canModifyPaidFeature(
  state: Pick<
    UIState,
    | "isAdminUser"
    | "subscriptionPlan"
    | "subscriptionStatus"
    | "subscriptionExpiresAt"
    | "subscriptionTrialEndsAt"
    | "trialChoiceMadeAt"
  >
): boolean {
  if (state.isAdminUser) return true;
  const countdown = getSubscriptionCountdownInfo({
    planId: state.subscriptionPlan,
    status: state.subscriptionStatus,
    expiresAt: state.subscriptionExpiresAt,
    trialEndsAt: state.subscriptionTrialEndsAt,
    trialChoiceMadeAt: state.trialChoiceMadeAt,
    isAdmin: state.isAdminUser,
  });
  return countdown.effectivePlanId !== "free";
}

export const useUIStore = create<UIState>((set, get) => ({
  userId: activeUserId,
  resetStore: () => {
    const prevUserId = activeUserId;
    if (typeof window !== "undefined") {
      try {
        const currentKey = getStorageKey();
        localStorage.removeItem(currentKey);
        localStorage.removeItem("monbudget_local_cache_v3");
        localStorage.removeItem("monbudget_local_cache_anon");
      } catch {}
    }
    if (prevUserId) {
      void closeAndDeleteUserOfflineDb(prevUserId);
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
      subscriptionHydrated: false,
      subscriptionPlan: "free",
      billingCycle: "none",
      subscriptionExpiresAt: null,
      subscriptionTrialEndsAt: null,
      trialChoiceMadeAt: null,
      subscriptionStatus: "active",
      inAppNotifications: [],
      unreadNotificationsCount: 0,
      syncStatus: "idle",
      pendingSyncCount: 0,
      pendingEntityIds: [],
      lastSyncedAt: null,
      lastSyncError: null,
      unresolvedConflictsCount: 0,
      syncConflicts: [],
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
  subscriptionHydrated: false,
  subscriptionPlan: initialCache?.subscriptionPlan ?? "free",
  billingCycle: initialCache?.billingCycle ?? "none",
  subscriptionExpiresAt: initialCache?.subscriptionExpiresAt ?? null,
  subscriptionTrialEndsAt: initialCache?.subscriptionTrialEndsAt ?? null,
  trialChoiceMadeAt: initialCache?.trialChoiceMadeAt ?? null,
  subscriptionStatus: initialCache?.subscriptionStatus ?? "active",
  inAppNotifications: [],
  unreadNotificationsCount: 0,
  refreshNotifications: async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.notifications)) {
        set({
          inAppNotifications: data.notifications,
          unreadNotificationsCount: Number(data.unreadCount) || 0,
        });
      }
    } catch {}
  },
  markNotificationsRead: async ({ notificationId, markAll }) => {
    // Mise à jour optimiste immédiate
    set((state) => {
      const nextList = state.inAppNotifications.map((item) => {
        if (markAll || (notificationId && item.id === notificationId)) {
          return { ...item, isRead: true };
        }
        return item;
      });
      return {
        inAppNotifications: nextList,
        unreadNotificationsCount: nextList.filter((item) => !item.isRead).length,
      };
    });

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(markAll ? { markAll: true } : { notificationId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.notifications)) {
          set({
            inAppNotifications: data.notifications,
            unreadNotificationsCount: Number(data.unreadCount) || 0,
          });
        }
      }
    } catch {}
  },
  chooseFreePlan: async () => {
    try {
      const res = await fetch("/api/subscription/choose-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        toast.error("Impossible d'activer le mode Gratuit pour le moment.");
        return false;
      }
      const data = await res.json();
      const sub = data?.subscription;
      if (sub) {
        set({
          subscriptionPlan: sub.planId || "free",
          billingCycle: sub.billingCycle || "none",
          subscriptionExpiresAt: sub.currentPeriodEnd || null,
          subscriptionTrialEndsAt: sub.trialEndsAt || null,
          trialChoiceMadeAt: sub.trialChoiceMadeAt || new Date().toISOString(),
          subscriptionStatus: sub.status || "active",
          subscriptionHydrated: true,
        });
        const cache = loadLocalCache();
        if (cache) {
          cache.subscriptionPlan = sub.planId || "free";
          cache.billingCycle = sub.billingCycle || "none";
          cache.subscriptionExpiresAt = sub.currentPeriodEnd || null;
          cache.subscriptionTrialEndsAt = sub.trialEndsAt || null;
          cache.trialChoiceMadeAt = sub.trialChoiceMadeAt || new Date().toISOString();
          cache.subscriptionStatus = sub.status || "active";
          saveLocalCache(cache);
        }
      }
      void get().refreshNotifications();
      return true;
    } catch {
      toast.error("Erreur réseau lors de l'activation du mode Gratuit.");
      return false;
    }
  },
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
            subscriptionTrialEndsAt: sub.trialEndsAt || null,
            trialChoiceMadeAt: sub.trialChoiceMadeAt || null,
            subscriptionStatus: nextStatus,
            subscriptionHydrated: true,
          });
          const cache = loadLocalCache();
          if (cache) {
            cache.subscriptionPlan = sub.planId;
            cache.billingCycle = sub.billingCycle || "none";
            cache.subscriptionExpiresAt = sub.currentPeriodEnd || null;
            cache.subscriptionTrialEndsAt = sub.trialEndsAt || null;
            cache.trialChoiceMadeAt = sub.trialChoiceMadeAt || null;
            cache.subscriptionStatus = nextStatus;
            saveLocalCache(cache);
          }
          return {
            planId: sub.planId as SubscriptionPlanId,
            orderStatus: data?.order?.status || null,
            isAdmin: serverIsAdmin,
          };
        }
        set({ isAdminUser: serverIsAdmin, subscriptionHydrated: true });
      }
    } catch {
    } finally {
      if (!get().subscriptionHydrated) {
        set({ subscriptionHydrated: true });
      }
    }
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
  syncStatus:
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "idle",
  pendingSyncCount: initialCache?.pendingSyncQueue?.length || 0,
  pendingEntityIds: [],
  lastSyncedAt: null,
  lastSyncError: null,
  unresolvedConflictsCount: 0,
  syncConflicts: [],
  canInstallPwa: false,
  isPwaInstalled: false,

  setOnlineStatus: (online) => {
    set((state) => ({
      isOnline: online,
      syncStatus: !online
        ? "offline"
        : state.syncStatus === "offline"
        ? "idle"
        : state.syncStatus,
    }));
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

  refreshOfflineDiagnostics: async () => {
    const uid = get().userId || activeUserId;
    if (!uid) return;
    const [outbox, conflicts, snapshot] = await Promise.all([
      listOutboxEntries(uid),
      listSyncConflicts(uid, true),
      readOfflineSnapshot(uid),
    ]);
    const entityIds = Array.from(new Set(outbox.map((o) => o.entityId)));
    const hasAuthPaused = outbox.some((o) => o.status === "auth_paused");
    const failedOp = outbox.find((o) => o.status === "failed");

    if (!get().isOnline && outbox.length > 0) {
      void requestBackgroundSync();
    }

    set((state) => ({
      pendingSyncCount: outbox.length,
      pendingEntityIds: entityIds,
      unresolvedConflictsCount: conflicts.length,
      syncConflicts: conflicts,
      lastSyncedAt: snapshot?.lastSuccessfulSyncAt || state.lastSyncedAt,
      lastSyncError: failedOp?.lastError || (hasAuthPaused ? "Session expirée — reconnexion requise." : null),
      syncStatus: !state.isOnline
        ? "offline"
        : hasAuthPaused
        ? "auth_expired"
        : failedOp
        ? "error"
        : state.syncStatus === "syncing"
        ? "syncing"
        : "idle",
      transactions: state.transactions.map((tx) => ({
        ...tx,
        pendingSync: entityIds.includes(tx.id),
      })),
    }));
  },

  resolveConflictChoice: async (conflictId, choice) => {
    const uid = get().userId || activeUserId;
    if (!uid) return;

    const allConflicts = await listSyncConflicts(uid, false);
    const conflict = allConflicts.find((c) => c.id === conflictId);
    if (!conflict) {
      await get().refreshOfflineDiagnostics();
      return;
    }

    if (choice === "dismiss") {
      await resolveSyncConflict(uid, conflictId, "manual_review");
      await appendOfflineAuditLog(uid, {
        level: "info",
        event: "conflict_dismissed",
        details: `Conflit [${conflict.entityType}] « ${conflict.label} » marqué comme révisé.`,
      });
      await get().refreshOfflineDiagnostics();
      toast.info("Conflit marqué comme révisé.");
      return;
    }

    const target = choice === "keep_local" ? conflict.localData : conflict.remoteData;
    if (!target) {
      await resolveSyncConflict(uid, conflictId, "manual_review");
      await get().refreshOfflineDiagnostics();
      return;
    }

    const isDeletedVersion = Boolean(target._deleted || target.deletedAt);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanObj: Record<string, any> = { ...target };
    delete cleanObj._deleted;
    delete cleanObj.deletedAt;
    delete cleanObj.updatedAt;

    const curState = get();
    const curMonthKey = getMonthKey(curState.activeMonth.year, curState.activeMonth.month);
    const fallbackDateStr =
      typeof cleanObj.date === "string"
        ? cleanObj.date
        : typeof cleanObj.transaction_date === "string"
        ? cleanObj.transaction_date
        : typeof cleanObj.received_date === "string"
        ? cleanObj.received_date
        : null;
    const derivedMonthKey =
      conflict.monthKey ||
      (fallbackDateStr && /^\d{4}-\d{2}/.test(fallbackDateStr)
        ? fallbackDateStr.slice(0, 7)
        : curMonthKey);
    const [mYearStr, mMonthStr] = derivedMonthKey.split("-");
    const targetYear = Number(mYearStr) || curState.activeMonth.year;
    const targetMonth = Number(mMonthStr) || curState.activeMonth.month;

    const snapshot = await readOfflineSnapshot(uid);
    const cache = loadLocalCache(uid);
    const nextSnapshot = snapshot || {
      schemaVersion: OFFLINE_DB_SCHEMA_VERSION,
      userId: uid,
      currency: curState.currency,
      payDay: curState.payDay,
      alertThreshold: curState.alertThreshold,
      months: {},
      savingsGoals: curState.savingsGoals,
      debts: curState.debts,
      updatedAt: new Date().toISOString(),
    };
    if (!nextSnapshot.months) nextSnapshot.months = {};

    const nowIso = new Date().toISOString();
    await clearOutboxEntriesForEntity(uid, conflict.entityId);

    if (conflict.entityType === "transaction") {
      const existingMonth = nextSnapshot.months[derivedMonthKey] ||
        cache?.months?.[derivedMonthKey] || {
          monthKey: derivedMonthKey,
          budgetId: derivedMonthKey === curMonthKey ? curState.budget_id : null,
          baseSalary: derivedMonthKey === curMonthKey ? curState.baseSalary : 0,
          income: derivedMonthKey === curMonthKey ? curState.income : 0,
          incomeEntries: derivedMonthKey === curMonthKey ? curState.incomeEntries : [],
          categories: derivedMonthKey === curMonthKey ? curState.categories : [],
          transactions: derivedMonthKey === curMonthKey ? curState.transactions : [],
        };

      const sourceTxs: Transaction[] =
        derivedMonthKey === curMonthKey
          ? curState.transactions
          : existingMonth.transactions || [];
      const sourceBaseSalary =
        derivedMonthKey === curMonthKey
          ? curState.baseSalary
          : existingMonth.baseSalary || 0;

      const rawType = cleanObj.type;
      const normType: "income" | "expense" =
        rawType === "income" || rawType === "income_adjustment" ? "income" : "expense";
      const normalizedTx: Transaction = {
        id: String(cleanObj.id || conflict.entityId),
        label: String(
          cleanObj.label ??
            cleanObj.description ??
            (normType === "income" ? "Revenu complémentaire" : "Dépense")
        ),
        amount: Number(cleanObj.amount) || 0,
        category: String(
          cleanObj.category || (normType === "income" ? "Revenu" : "Autre (Hors Budget)")
        ),
        category_id: cleanObj.category_id ? String(cleanObj.category_id) : undefined,
        date: String(
          cleanObj.date ?? cleanObj.transaction_date ?? new Date().toISOString().split("T")[0]
        ),
        type: normType,
        linkedDebtId: cleanObj.linkedDebtId,
        linkedPaymentId: cleanObj.linkedPaymentId,
        linkedSavingsGoalId: cleanObj.linkedSavingsGoalId,
        linkedContributionId: cleanObj.linkedContributionId,
        receiptUrl: cleanObj.receiptUrl,
        receiptName: cleanObj.receiptName,
        pendingSync: !isDeletedVersion,
      };

      const nextTxs = isDeletedVersion
        ? sourceTxs.filter((t) => t.id !== conflict.entityId)
        : sourceTxs.some((t) => t.id === normalizedTx.id)
        ? sourceTxs.map((t) => (t.id === normalizedTx.id ? normalizedTx : t))
        : [normalizedTx, ...sourceTxs].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

      const additionalIncomes = nextTxs
        .filter((t) => t.type === "income" || t.type === "income_adjustment")
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const nextIncome = sourceBaseSalary + additionalIncomes;

      if (derivedMonthKey === curMonthKey) {
        set({ transactions: nextTxs, income: nextIncome });
      }

      nextSnapshot.months[derivedMonthKey] = {
        ...existingMonth,
        monthKey: derivedMonthKey,
        transactions: nextTxs,
        income: nextIncome,
        updatedAt: nowIso,
      };
      if (cache) {
        cache.months[derivedMonthKey] = {
          ...(cache.months[derivedMonthKey] || existingMonth),
          transactions: nextTxs,
          income: nextIncome,
        };
      }

      if (isDeletedVersion) {
        await enqueueOutboxEntry(uid, {
          entityType: "transaction",
          entityId: conflict.entityId,
          monthKey: derivedMonthKey,
          type: "delete_transaction",
          payload: { id: conflict.entityId },
          clientUpdatedAt: nowIso,
        });
      } else {
        let catId = normalizedTx.category_id || null;
        if (!catId && normType !== "income") {
          const matchedCat = (existingMonth.categories || []).find(
            (c: Category) => c.name.trim().toLowerCase() === normalizedTx.category.trim().toLowerCase()
          );
          if (matchedCat && UUID_REGEX.test(matchedCat.id)) {
            catId = matchedCat.id;
          }
        }
        await enqueueOutboxEntry(uid, {
          entityType: "transaction",
          entityId: normalizedTx.id,
          monthKey: derivedMonthKey,
          type: "upsert_transaction",
          payload: {
            id: normalizedTx.id,
            monthly_budget_id: existingMonth.budgetId || null,
            year: targetYear,
            month: targetMonth,
            category_id: normType === "income" ? null : catId,
            amount: normalizedTx.amount,
            description: normalizedTx.label,
            transaction_date: normalizedTx.date,
            type: normType === "income" ? "income_adjustment" : "expense",
          },
          clientUpdatedAt: nowIso,
        });
      }
    } else if (conflict.entityType === "income_entry") {
      const existingMonth = nextSnapshot.months[derivedMonthKey] ||
        cache?.months?.[derivedMonthKey] || {
          monthKey: derivedMonthKey,
          budgetId: derivedMonthKey === curMonthKey ? curState.budget_id : null,
          baseSalary: derivedMonthKey === curMonthKey ? curState.baseSalary : 0,
          income: derivedMonthKey === curMonthKey ? curState.income : 0,
          incomeEntries: derivedMonthKey === curMonthKey ? curState.incomeEntries : [],
          categories: derivedMonthKey === curMonthKey ? curState.categories : [],
          transactions: derivedMonthKey === curMonthKey ? curState.transactions : [],
        };

      const sourceEntries: IncomeSourceEntry[] =
        derivedMonthKey === curMonthKey
          ? curState.incomeEntries
          : existingMonth.incomeEntries || [];
      const sourceTxs: Transaction[] =
        derivedMonthKey === curMonthKey
          ? curState.transactions
          : existingMonth.transactions || [];

      const normalizedInc: IncomeSourceEntry = {
        id: String(cleanObj.id || conflict.entityId),
        label: String(cleanObj.label || "Revenu"),
        sourceType: String(cleanObj.sourceType ?? cleanObj.source_type ?? "Salaire"),
        amount: Number(cleanObj.amount) || 0,
        date: cleanObj.date ?? cleanObj.received_date ?? undefined,
      };

      const nextEntries = isDeletedVersion
        ? sourceEntries.filter((e) => e.id !== conflict.entityId)
        : sourceEntries.some((e) => e.id === normalizedInc.id)
        ? sourceEntries.map((e) => (e.id === normalizedInc.id ? normalizedInc : e))
        : [...sourceEntries, normalizedInc];

      const nextBaseSalary = nextEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
      const additionalIncomes = sourceTxs
        .filter((t) => t.type === "income" || t.type === "income_adjustment")
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const nextIncome = nextBaseSalary + additionalIncomes;

      if (derivedMonthKey === curMonthKey) {
        set({
          incomeEntries: nextEntries,
          baseSalary: nextBaseSalary,
          income: nextIncome,
        });
      }

      nextSnapshot.months[derivedMonthKey] = {
        ...existingMonth,
        monthKey: derivedMonthKey,
        incomeEntries: nextEntries,
        baseSalary: nextBaseSalary,
        income: nextIncome,
        updatedAt: nowIso,
      };
      if (cache) {
        cache.months[derivedMonthKey] = {
          ...(cache.months[derivedMonthKey] || existingMonth),
          incomeEntries: nextEntries,
          baseSalary: nextBaseSalary,
          income: nextIncome,
        };
      }

      if (isDeletedVersion) {
        await enqueueOutboxEntry(uid, {
          entityType: "income_entry",
          entityId: conflict.entityId,
          monthKey: derivedMonthKey,
          type: "delete_income_entry",
          payload: { id: conflict.entityId },
          clientUpdatedAt: nowIso,
        });
      } else {
        await enqueueOutboxEntry(uid, {
          entityType: "income_entry",
          entityId: normalizedInc.id,
          monthKey: derivedMonthKey,
          type: "upsert_income_entry",
          payload: {
            id: normalizedInc.id,
            monthly_budget_id: existingMonth.budgetId || null,
            year: targetYear,
            month: targetMonth,
            label: normalizedInc.label,
            source_type: normalizedInc.sourceType,
            amount: normalizedInc.amount,
            received_date: normalizedInc.date || new Date().toISOString().split("T")[0],
          },
          clientUpdatedAt: nowIso,
        });
      }
    } else if (conflict.entityType === "savings_goal") {
      const normalizedGoal: SavingsGoal = {
        id: String(cleanObj.id || conflict.entityId),
        name: String(cleanObj.name || "Objectif d'épargne"),
        target: Number(cleanObj.target ?? cleanObj.target_amount) || 0,
        current: Number(cleanObj.current ?? cleanObj.current_amount) || 0,
        color: String(cleanObj.color || "bg-blue-500"),
        target_date: cleanObj.target_date ?? undefined,
        status: (cleanObj.status as "active" | "completed" | "paused") || "active",
        contributions: Array.isArray(cleanObj.contributions) ? cleanObj.contributions : [],
      };

      const nextGoals = isDeletedVersion
        ? curState.savingsGoals.filter((g) => g.id !== conflict.entityId)
        : curState.savingsGoals.some((g) => g.id === normalizedGoal.id)
        ? curState.savingsGoals.map((g) => (g.id === normalizedGoal.id ? normalizedGoal : g))
        : [normalizedGoal, ...curState.savingsGoals];

      set({ savingsGoals: nextGoals });
      nextSnapshot.savingsGoals = nextGoals;
      if (cache) cache.savingsGoals = nextGoals;

      if (isDeletedVersion) {
        await enqueueOutboxEntry(uid, {
          entityType: "savings_goal",
          entityId: conflict.entityId,
          type: "delete_savings_goal",
          payload: { id: conflict.entityId },
          clientUpdatedAt: nowIso,
        });
      } else {
        await enqueueOutboxEntry(uid, {
          entityType: "savings_goal",
          entityId: normalizedGoal.id,
          type: "upsert_savings_goal",
          payload: {
            id: normalizedGoal.id,
            name: normalizedGoal.name,
            target_amount: normalizedGoal.target,
            current_amount: normalizedGoal.current,
            color: normalizedGoal.color,
            target_date: normalizedGoal.target_date || null,
            status: normalizedGoal.status,
          },
          clientUpdatedAt: nowIso,
        });
      }
    } else if (conflict.entityType === "debt") {
      const normalizedDebt: DebtItem = {
        id: String(cleanObj.id || conflict.entityId),
        type: cleanObj.type === "receivable" ? "receivable" : "payable",
        personName: String(cleanObj.personName ?? cleanObj.person_name ?? "Contact"),
        phone: cleanObj.phone ?? undefined,
        totalAmount: Number(cleanObj.totalAmount ?? cleanObj.total_amount) || 0,
        remainingAmount:
          Number(
            cleanObj.remainingAmount ??
              cleanObj.remaining_amount ??
              cleanObj.totalAmount ??
              cleanObj.total_amount
          ) || 0,
        dueDate: cleanObj.dueDate ?? cleanObj.due_date ?? undefined,
        status: (cleanObj.status as "pending" | "partial" | "paid") || "pending",
        notes: cleanObj.notes ?? undefined,
        payments: Array.isArray(cleanObj.payments) ? cleanObj.payments : [],
        createdAt: String(cleanObj.createdAt ?? cleanObj.created_at ?? nowIso),
      };

      const nextDebts = isDeletedVersion
        ? curState.debts.filter((d) => d.id !== conflict.entityId)
        : curState.debts.some((d) => d.id === normalizedDebt.id)
        ? curState.debts.map((d) => (d.id === normalizedDebt.id ? normalizedDebt : d))
        : [normalizedDebt, ...curState.debts];

      set({ debts: nextDebts });
      nextSnapshot.debts = nextDebts;
      if (cache) cache.debts = nextDebts;

      if (isDeletedVersion) {
        await enqueueOutboxEntry(uid, {
          entityType: "debt",
          entityId: conflict.entityId,
          type: "delete_debt",
          payload: { id: conflict.entityId },
          clientUpdatedAt: nowIso,
        });
      } else {
        await enqueueOutboxEntry(uid, {
          entityType: "debt",
          entityId: normalizedDebt.id,
          type: "upsert_debt",
          payload: {
            id: normalizedDebt.id,
            type: normalizedDebt.type,
            person_name: normalizedDebt.personName,
            phone: normalizedDebt.phone || null,
            total_amount: normalizedDebt.totalAmount,
            remaining_amount: normalizedDebt.remainingAmount,
            due_date: normalizedDebt.dueDate || null,
            status: normalizedDebt.status,
            notes: normalizedDebt.notes || null,
          },
          clientUpdatedAt: nowIso,
        });
      }
    }

    if (cache && typeof window !== "undefined") {
      try {
        localStorage.setItem(getStorageKey(uid), JSON.stringify(cache));
      } catch {}
    }
    await writeOfflineSnapshot(uid, nextSnapshot);

    await resolveSyncConflict(
      uid,
      conflictId,
      choice === "keep_local" ? "local_wins" : "remote_wins"
    );
    await appendOfflineAuditLog(uid, {
      level: "info",
      event: "conflict_manually_resolved",
      details: `Conflit [${conflict.entityType}] « ${conflict.label} » résolu manuellement (${choice}).`,
    });
    await get().refreshOfflineDiagnostics();

    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }

    toast.success(
      choice === "keep_local"
        ? "Version locale conservée et planifiée pour synchronisation."
        : "Version serveur appliquée et conservée."
    );
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
    }

    const uid = get().userId || activeUserId;
    if (!uid) return;

    void (async () => {
      if (action.type === "add_transaction") {
        const txId = ensureValidUuid(action.payload?.id);
        await enqueueOutboxEntry(uid, {
          id: syncAction.id,
          entityType: "transaction",
          entityId: txId,
          type: "upsert_transaction",
          payload: { ...action.payload, id: txId },
          clientUpdatedAt: new Date(syncAction.timestamp).toISOString(),
        });
      } else if (action.type === "remove_transaction" && action.payload?.id) {
        await enqueueOutboxEntry(uid, {
          id: syncAction.id,
          entityType: "transaction",
          entityId: String(action.payload.id),
          type: "delete_transaction",
          payload: { id: String(action.payload.id) },
          clientUpdatedAt: new Date(syncAction.timestamp).toISOString(),
        });
      } else if (action.type === "update_category_amount") {
        const catId = String(action.payload?.categoryId || "");
        await enqueueOutboxEntry(uid, {
          id: syncAction.id,
          entityType: "allocation",
          entityId: catId,
          coalesceKey: `alloc:${action.payload?.budgetId || "active"}:${catId}`,
          type: "upsert_allocation",
          payload: action.payload || {},
          clientUpdatedAt: new Date(syncAction.timestamp).toISOString(),
        });
      }
      await get().refreshOfflineDiagnostics();
    })();
  },

  syncPendingQueue: async (force = false, quietIfSingle = false) => {
    let uid = get().userId || activeUserId;
    if (!uid) {
      const { data: sessionData } = await supabase.auth.getSession();
      uid = sessionData?.session?.user?.id || null;
      if (uid) {
        activeUserId = uid;
        set({ userId: uid });
      }
    }
    if (!uid) return 0;

    // Migrer d'éventuelles opérations résiduelles du cache localStorage vers IndexedDB
    const legacyCache = loadLocalCache(uid);
    if (legacyCache?.pendingSyncQueue && legacyCache.pendingSyncQueue.length > 0) {
      await migrateLegacyCacheToIndexedDb(uid, legacyCache);
      legacyCache.pendingSyncQueue = [];
      saveLocalCache(legacyCache, uid);
    }

    const beforeQueue = await listOutboxEntries(uid);
    if (beforeQueue.length === 0) {
      set({
        pendingSyncCount: 0,
        pendingEntityIds: [],
        lastSyncError: null,
        syncStatus: get().isOnline ? "idle" : "offline",
      });
      return 0;
    }

    const hadOfflineBacklog =
      force ||
      !quietIfSingle ||
      beforeQueue.length > 1 ||
      beforeQueue.some((item) => item.retryCount > 0 || item.status === "failed");

    set({ syncStatus: "syncing", lastSyncError: null });

    const result = await processOutboxQueue(supabase, uid, { force });
    const remainingOutbox = await listOutboxEntries(uid);
    const pendingIds = Array.from(new Set(remainingOutbox.map((o) => o.entityId)));

    if (
      result.status === "offline" ||
      (result.pending > 0 && result.status !== "auth_expired")
    ) {
      void requestBackgroundSync();
    }

    const nowIso = new Date().toISOString();
    if (result.synced > 0) {
      const snap = await readOfflineSnapshot(uid);
      if (snap) {
        await writeOfflineSnapshot(uid, {
          ...snap,
          lastSyncedAt: result.serverTime || nowIso,
          lastSuccessfulSyncAt: nowIso,
        });
      }
    }

    set((state) => ({
      isOnline: result.status === "offline" ? false : true,
      syncStatus: result.status,
      pendingSyncCount: result.pending,
      pendingEntityIds: pendingIds,
      lastSyncedAt: result.synced > 0 ? nowIso : state.lastSyncedAt,
      lastSyncError: result.lastError || null,
      transactions: state.transactions.map((tx) => ({
        ...tx,
        pendingSync: pendingIds.includes(tx.id),
      })),
    }));

    if (result.status === "auth_expired") {
      toast.warning(
        "Session expirée pendant le mode hors-ligne. Vos données sont en sécurité : reconnectez-vous pour finaliser la synchronisation."
      );
      return 0;
    }

    if (result.synced > 0 && hadOfflineBacklog) {
      toast.success(
        `Synchronisation terminée : ${result.synced} opération(s) enregistrée(s) sur le serveur !`
      );
      await get().initStore();
    }
    return result.synced;
  },

  exportOfflineBackup: async () => {
    const uid = get().userId || activeUserId;
    if (!uid || typeof window === "undefined") return;
    try {
      const pkg = await exportOfflineBackupPackage(uid);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `monbudget-sauvegarde-offline-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await appendOfflineAuditLog(uid, {
        level: "info",
        event: "backup_exported",
        details: `Sauvegarde locale exportée (${pkg.outbox.length} opération(s) en attente).`,
      });
      toast.success("Sauvegarde locale vérifiée (SHA-256) téléchargée !");
    } catch {
      toast.error("Impossible de générer la sauvegarde locale.");
    }
  },

  restoreOfflineBackup: async (jsonText: string) => {
    const uid = get().userId || activeUserId;
    if (!uid) {
      return { ok: false, error: "Utilisateur non identifié." };
    }
    try {
      const parsed = JSON.parse(jsonText);
      const res = await verifyAndRestoreOfflineBackupPackage(uid, parsed);
      if (!res.ok) {
        toast.error(res.error || "Échec de la restauration.");
        return { ok: false, error: res.error };
      }
      await get().initStore();
      toast.success(
        `Sauvegarde restaurée (${res.restoredMonths} mois, ${res.restoredOutbox} opération(s) en file).`
      );
      return { ok: true };
    } catch {
      const err = "Fichier JSON invalide ou corrompu.";
      toast.error(err);
      return { ok: false, error: err };
    }
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
      // 1. Identifier l'utilisateur localement (fonctionne même 100 % hors-ligne via session locale)
      let resolvedUserId: string | null = null;
      let resolvedUserEmail: string | undefined;
      let resolvedUserMetaName: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolvedUserMetaNotifs: any;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          resolvedUserId = sessionData.session.user.id;
          resolvedUserEmail = sessionData.session.user.email;
          resolvedUserMetaName = sessionData.session.user.user_metadata?.full_name;
          resolvedUserMetaNotifs = sessionData.session.user.user_metadata?.notifications;
        }
      } catch {}

      if (!resolvedUserId) {
        resolvedUserId = activeUserId || getSavedUserId();
      }
      if (!resolvedUserId) return;

      activeUserId = resolvedUserId;
      set({ userId: resolvedUserId });

      // Nettoyer l'ancien cache global non partitionné et migrer vers IndexedDB par utilisateur
      if (typeof window !== "undefined") {
        try {
          const userKey = getStorageKey(resolvedUserId);
          if (!localStorage.getItem(userKey)) {
            const legacy = localStorage.getItem("monbudget_local_cache_v3");
            if (legacy) {
              localStorage.setItem(userKey, legacy);
            }
          }
          localStorage.removeItem("monbudget_local_cache_v3");
        } catch {}
      }

      const legacyUserCache = loadLocalCache(resolvedUserId);
      if (legacyUserCache) {
        await migrateLegacyCacheToIndexedDb(resolvedUserId, legacyUserCache);
        if (legacyUserCache.pendingSyncQueue && legacyUserCache.pendingSyncQueue.length > 0) {
          legacyUserCache.pendingSyncQueue = [];
          saveLocalCache(legacyUserCache, resolvedUserId);
        }
      }

      const { year, month } = get().activeMonth;
      const monthKey = getMonthKey(year, month);

      // 2. Hydratation immédiate depuis IndexedDB (démarrage instantané hors-ligne comme en ligne)
      const [idbSnapshot, pendingOutboxBeforeSync, unresolvedConflictsBeforeSync] =
        await Promise.all([
          readOfflineSnapshot(resolvedUserId),
          listOutboxEntries(resolvedUserId),
          listSyncConflicts(resolvedUserId, true),
        ]);
      const pendingIds = Array.from(new Set(pendingOutboxBeforeSync.map((o) => o.entityId)));

      if (idbSnapshot) {
        const idbMonth = idbSnapshot.months?.[monthKey];
        set((state) => ({
          currency: idbSnapshot.currency || state.currency,
          payDay: idbSnapshot.payDay || state.payDay,
          alertThreshold: idbSnapshot.alertThreshold ?? state.alertThreshold,
          notifications: idbSnapshot.notifications
            ? { ...defaultNotifications, ...idbSnapshot.notifications }
            : state.notifications,
          budget_id: idbMonth?.budgetId || state.budget_id,
          baseSalary: idbMonth ? idbMonth.baseSalary : state.baseSalary,
          income: idbMonth ? idbMonth.income : state.income,
          incomeEntries: idbMonth?.incomeEntries || state.incomeEntries,
          categories:
            idbMonth?.categories && idbMonth.categories.length > 0
              ? deduplicateCategories(idbMonth.categories)
              : state.categories,
          transactions: idbMonth?.transactions
            ? idbMonth.transactions.map((tx: Transaction) => ({
                ...tx,
                pendingSync: pendingIds.includes(tx.id),
              }))
            : state.transactions,
          savingsGoals:
            idbSnapshot.savingsGoals && idbSnapshot.savingsGoals.length > 0
              ? idbSnapshot.savingsGoals
              : state.savingsGoals,
          debts:
            idbSnapshot.debts && idbSnapshot.debts.length > 0
              ? idbSnapshot.debts
              : state.debts,
          subscriptionPlan:
            (idbSnapshot.subscriptionPlan as SubscriptionPlanId) || state.subscriptionPlan,
          billingCycle:
            (idbSnapshot.billingCycle as BillingCycle | "none") || state.billingCycle,
          subscriptionExpiresAt:
            idbSnapshot.subscriptionExpiresAt !== undefined
              ? idbSnapshot.subscriptionExpiresAt
              : state.subscriptionExpiresAt,
          subscriptionTrialEndsAt:
            idbSnapshot.subscriptionTrialEndsAt !== undefined
              ? idbSnapshot.subscriptionTrialEndsAt
              : state.subscriptionTrialEndsAt,
          trialChoiceMadeAt:
            idbSnapshot.trialChoiceMadeAt !== undefined
              ? idbSnapshot.trialChoiceMadeAt
              : state.trialChoiceMadeAt,
          subscriptionStatus:
            (idbSnapshot.subscriptionStatus as SubscriptionStatus) || state.subscriptionStatus,
          lastSyncedAt: idbSnapshot.lastSuccessfulSyncAt || state.lastSyncedAt,
          pendingSyncCount: pendingOutboxBeforeSync.length,
          pendingEntityIds: pendingIds,
          unresolvedConflictsCount: unresolvedConflictsBeforeSync.length,
          syncConflicts: unresolvedConflictsBeforeSync,
        }));
      } else {
        set({
          pendingSyncCount: pendingOutboxBeforeSync.length,
          pendingEntityIds: pendingIds,
          unresolvedConflictsCount: unresolvedConflictsBeforeSync.length,
          syncConflicts: unresolvedConflictsBeforeSync,
        });
      }

      // 3. Vérifier si le serveur est réellement joignable avant toute requête réseau
      const probe = await checkServerReachability(3500);
      if (!probe.reachable) {
        if (pendingOutboxBeforeSync.length > 0) {
          void requestBackgroundSync();
        }
        set({
          isOnline: false,
          syncStatus: "offline",
          subscriptionHydrated: true,
        });
        return;
      }

      set({ isOnline: true });

      // 4. Vider d'abord la file d'attente locale vers Supabase AVANT de tirer les données distantes
      if (pendingOutboxBeforeSync.length > 0) {
        set({ syncStatus: "syncing" });
        const pushRes = await processOutboxQueue(supabase, resolvedUserId);
        if (pushRes.status === "auth_expired") {
          set({
            syncStatus: "auth_expired",
            lastSyncError: pushRes.lastError || "Session expirée.",
            subscriptionHydrated: true,
          });
          return;
        }
      }

      // 5. Validation serveur de l'utilisateur authentifié
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const user = authData?.user;
      if (authErr || !user) {
        const afterOutbox = await listOutboxEntries(resolvedUserId);
        if (afterOutbox.length > 0) {
          set({
            syncStatus: "auth_expired",
            pendingSyncCount: afterOutbox.length,
            lastSyncError: "Session expirée — reconnexion requise pour synchroniser.",
            subscriptionHydrated: true,
          });
        }
        return;
      }

      // Préchauffer l'App Shell PWA dans le Service Worker pour garantir la navigation hors-ligne
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => reg.active?.postMessage({ type: "WARM_APP_SHELL" }))
          .catch(() => {});
      }

      const subscriptionPromise = get().refreshSubscription().catch(() => {});
      const activeOutbox = await listOutboxEntries(user.id);
      const lastSyncedCursor = idbSnapshot?.lastSyncedAt || null;

      // 6. Profil & Préférences
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from("profiles").insert({
          id: user.id,
          full_name: resolvedUserMetaName || "Utilisateur",
          currency: "FCFA",
          alert_threshold_percent: 80,
          pay_day: 28,
        });
        set({ currency: "FCFA", alertThreshold: 80, payDay: 28 });
      } else {
        const hasPendingPrefs = activeOutbox.some((o) => o.entityType === "preferences");
        if (!hasPendingPrefs) {
          let cur = profile.currency && profile.currency.trim() ? profile.currency.trim() : "FCFA";
          if (cur === "EUR" || cur === "€") {
            cur = "FCFA";
            await supabase.from("profiles").update({ currency: "FCFA" }).eq("id", user.id);
          }
          const th = profile.alert_threshold_percent ? Number(profile.alert_threshold_percent) : 80;
          const pd = profile.pay_day ? Number(profile.pay_day) : 28;
          const remoteNotifs = profile.notifications || resolvedUserMetaNotifs;
          const finalNotifs = remoteNotifs
            ? { ...defaultNotifications, ...remoteNotifs }
            : get().notifications || defaultNotifications;

          set({ currency: cur, alertThreshold: th, payDay: pd, notifications: finalNotifs });
        }
      }

      // 7. Budget mensuel
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

        // 8. Revenus de base (multi-sources) avec réconciliation & tombstones deleted_at
        const { data: incomes } = await supabase
          .from("income_entries")
          .select("*")
          .eq("monthly_budget_id", budget.id);

        const remoteIncomeEntries: (IncomeSourceEntry & {
          updatedAt?: string;
          deletedAt?: string | null;
        })[] = (incomes || []).map((inc) => ({
          id: inc.id,
          label: inc.label || "Salaire principal",
          sourceType: inc.source_type || "Salaire",
          amount: Number(inc.amount) || 0,
          date: inc.received_date || undefined,
          updatedAt: inc.updated_at,
          deletedAt: inc.deleted_at || null,
        }));

        const reconciledIncomeEntries = await reconcileRecordsWithConflictDetection({
          userId: user.id,
          entityType: "income_entry",
          monthKey,
          remoteItems: remoteIncomeEntries,
          localItems: get().incomeEntries,
          pendingOutbox: activeOutbox,
          lastSyncedAt: lastSyncedCursor,
          getLabel: (item) => item.label,
        });

        const fetchedBaseSalary = reconciledIncomeEntries.reduce((sum, inc) => sum + inc.amount, 0);

        // 9. Catégories & Allocations (exclusion stricte de deleted_at non nul)
        let { data: allCategories } = await supabase
          .from("categories")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true);

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activeRemoteCategories = (allCategories || []).filter((cat: any) => !cat.deleted_at);

        const effectiveCategoriesList =
          activeRemoteCategories.length > 0
            ? activeRemoteCategories
            : allCategories && allCategories.length > 0
            ? []
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activeAllocations = (allocations || []).filter((a: any) => !a.deleted_at);

        const pendingDeletedCatIds = new Set(
          activeOutbox
            .filter((o) => o.type === "delete_category")
            .map((o) => o.entityId)
        );

        const rawCategories: (Category & { updatedAt?: string })[] = effectiveCategoriesList
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((cat: any) => !cat.deleted_at && !pendingDeletedCatIds.has(cat.id))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((cat: any) => {
            const alloc = activeAllocations.find((a) => a.category_id === cat.id);
            return {
              id: cat.id,
              name: cat.name.trim(),
              color: cat.color || "bg-blue-500",
              amount: alloc ? Number(alloc.allocated_amount) : 0,
              allocation_id: alloc?.id,
              updatedAt: alloc?.updated_at || cat.updated_at,
            };
          });
        const categoriesMap: Category[] = deduplicateCategories(rawCategories);

        // Archiver les éventuels doublons de catégories actives côté serveur
        const seenCatNames = new Set<string>();
        const redundantCatIds: string[] = [];
        for (const cat of activeRemoteCategories) {
          const norm = cat.name.trim().toLowerCase();
          if (seenCatNames.has(norm)) {
            redundantCatIds.push(cat.id);
          } else {
            seenCatNames.add(norm);
          }
        }
        if (redundantCatIds.length > 0) {
          void supabase.from("categories").update({ is_active: false }).in("id", redundantCatIds);
        }

        // 10. Transactions avec réconciliation anti-résurrection, tombstones & détection de conflits
        const { data: txs } = await supabase
          .from("transactions")
          .select("*, categories(name)")
          .eq("monthly_budget_id", budget.id)
          .order("transaction_date", { ascending: false });

        const mappedTxs: (Transaction & { updatedAt?: string; deletedAt?: string | null })[] = (
          txs || []
        ).map((tx) => {
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
            updatedAt: tx.updated_at,
            deletedAt: tx.deleted_at || null,
          };
        });

        const badIncomeTxs = (txs || []).filter(
          (t) =>
            !t.deleted_at &&
            (t.type === "income" || t.type === "income_adjustment") &&
            t.category_id !== null
        );
        if (badIncomeTxs.length > 0) {
          const badIds = badIncomeTxs.map((t) => t.id);
          void supabase.from("transactions").update({ category_id: null }).in("id", badIds);
        }

        const currentOutboxIds = new Set(activeOutbox.map((o) => o.entityId));
        const reconciledTxs = await reconcileRecordsWithConflictDetection({
          userId: user.id,
          entityType: "transaction",
          monthKey,
          remoteItems: mappedTxs,
          localItems: get().transactions,
          pendingOutbox: activeOutbox,
          lastSyncedAt: lastSyncedCursor,
          getLabel: (item) => `${item.label} (${item.amount} FCFA)`,
        });

        const finalTxs = reconciledTxs
          .map((tx) => ({
            ...tx,
            pendingSync: currentOutboxIds.has(tx.id),
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const finalAdditionalIncomes = finalTxs
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0);

        const currentCats = get().categories;
        const mergedCats: Category[] = categoriesMap.map((remoteCat) => {
          const localMatch = currentCats.find(
            (c) =>
              c.id === remoteCat.id ||
              c.name.trim().toLowerCase() === remoteCat.name.trim().toLowerCase()
          );
          const hasPendingAlloc = activeOutbox.some(
            (o) =>
              o.entityType === "allocation" &&
              (o.entityId === remoteCat.id || (localMatch && o.entityId === localMatch.id))
          );
          if (hasPendingAlloc && localMatch) {
            return {
              ...remoteCat,
              amount: localMatch.amount,
              color: localMatch.color || remoteCat.color,
            };
          }
          if (remoteCat.amount > 0) {
            return remoteCat;
          }
          if (localMatch && localMatch.amount > 0 && !remoteCat.allocation_id) {
            return {
              ...remoteCat,
              amount: localMatch.amount,
              color: localMatch.color || remoteCat.color,
            };
          }
          return remoteCat;
        });

        for (const localCat of currentCats) {
          if (pendingDeletedCatIds.has(localCat.id)) continue;
          const exists = mergedCats.some(
            (c) => c.name.trim().toLowerCase() === localCat.name.trim().toLowerCase()
          );
          if (!exists) {
            mergedCats.push(localCat);
          }
        }

        const finalCats = mergedCats.length > 0 ? deduplicateCategories(mergedCats) : currentCats;

        const localBaseSalary = get().baseSalary;
        const hasPendingSalary = activeOutbox.some((o) => o.entityType === "primary_salary");
        const hasRemoteDeletedIncomes = (incomes || []).some((inc) => Boolean(inc.deleted_at));
        const finalBaseSalary = hasPendingSalary
          ? localBaseSalary
          : fetchedBaseSalary > 0
          ? fetchedBaseSalary
          : hasRemoteDeletedIncomes
          ? 0
          : localBaseSalary > 0
          ? localBaseSalary
          : 0;
        const finalIncomeEntries =
          reconciledIncomeEntries.length > 0
            ? reconciledIncomeEntries
            : finalBaseSalary > 0
            ? [
                {
                  id: "local-salary",
                  label: "Salaire principal",
                  sourceType: "Salaire",
                  amount: finalBaseSalary,
                },
              ]
            : [];
        const finalIncome = finalBaseSalary + finalAdditionalIncomes;

        set({
          baseSalary: finalBaseSalary,
          income: finalIncome,
          incomeEntries: finalIncomeEntries,
          categories: finalCats,
          transactions: finalTxs,
        });

        await subscriptionPromise;

        // 11. Objectifs d'épargne avec réconciliation & filtrage des contributions supprimées (deleted_at)
        const { data: goals } = await supabase
          .from("savings_goals")
          .select("*, savings_contributions(*)")
          .eq("user_id", user.id);

        if (goals) {
          const mappedGoals: (SavingsGoal & { updatedAt?: string; deletedAt?: string | null })[] =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            goals.map((g: any) => {
              const contributions: SavingsContribution[] = (g.savings_contributions || [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((c: any) => !c.deleted_at)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((c: any) => ({
                  id: c.id,
                  amount: Number(c.amount),
                  date: c.contribution_date,
                  notes: c.notes || undefined,
                }))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
                updatedAt: g.updated_at,
                deletedAt: g.deleted_at || null,
              };
            });

          const reconciledGoals = await reconcileRecordsWithConflictDetection({
            userId: user.id,
            entityType: "savings_goal",
            remoteItems: mappedGoals,
            localItems: get().savingsGoals,
            pendingOutbox: activeOutbox,
            lastSyncedAt: lastSyncedCursor,
            getLabel: (item) => item.name,
          });
          set({ savingsGoals: reconciledGoals });
        }

        // Synchroniser automatiquement l'enveloppe Épargne dans Mon Budget si des épargnes existent
        const activeGoals = get().savingsGoals;
        const monthlySavingsAmount = getMonthlySavingsContributions(activeGoals, year, month);
        const txSavingsAmount = getSpentByCategory(get().transactions, "Épargne", monthlySavingsAmount);
        const effectiveMonthlySavings = Math.max(monthlySavingsAmount, txSavingsAmount);
        if (canModifyPaidFeature(get()) && effectiveMonthlySavings > 0) {
          const currentCats2 = get().categories;
          const hasSavingsCat = currentCats2.some(
            (c) => c.name.trim().toLowerCase() === "épargne" || c.name.trim().toLowerCase() === "epargne"
          );
          let syncedSavingsCats = currentCats2;
          if (!hasSavingsCat) {
            const newSavCat: Category = {
              id: ensureValidUuid(null),
              name: "Épargne",
              amount: effectiveMonthlySavings,
              color: "bg-emerald-600",
            };
            syncedSavingsCats = deduplicateCategories([...currentCats2, newSavCat]);
          } else {
            syncedSavingsCats = currentCats2.map((c) => {
              const norm = c.name.trim().toLowerCase();
              if (norm === "épargne" || norm === "epargne") {
                return { ...c, amount: Math.max(Number(c.amount) || 0, effectiveMonthlySavings) };
              }
              return c;
            });
          }
          set({ categories: syncedSavingsCats });
        }

        // 12. Dettes & Créances avec réconciliation & filtrage des paiements supprimés (deleted_at)
        try {
          const { data: remoteDebts } = await supabase
            .from("debts")
            .select("*, debt_payments(*)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (remoteDebts) {
            const mappedDebts: (DebtItem & { updatedAt?: string; deletedAt?: string | null })[] =
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              remoteDebts.map((d: any) => {
                const payments: DebtPaymentItem[] = (d.debt_payments || [])
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .filter((p: any) => !p.deleted_at)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((p: any) => ({
                    id: p.id,
                    amount: Number(p.amount),
                    date: p.payment_date,
                    notes: p.notes || undefined,
                  }))
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                const sumPaid = payments.reduce((s, p) => s + p.amount, 0);
                const totalAmt = Number(d.total_amount) || 0;
                const remainingAmt =
                  payments.length > 0
                    ? Math.max(0, totalAmt - sumPaid)
                    : Number(d.remaining_amount ?? totalAmt);

                return {
                  id: d.id,
                  type: (d.type === "receivable" ? "receivable" : "payable") as "payable" | "receivable",
                  personName: d.person_name,
                  phone: d.phone || undefined,
                  totalAmount: totalAmt,
                  remainingAmount: remainingAmt,
                  dueDate: d.due_date || undefined,
                  status: remainingAmt <= 0 ? "paid" : sumPaid > 0 ? "partial" : d.status || "pending",
                  notes: d.notes || undefined,
                  payments,
                  createdAt: d.created_at,
                  updatedAt: d.updated_at,
                  deletedAt: d.deleted_at || null,
                };
              });

            const reconciledDebts = await reconcileRecordsWithConflictDetection({
              userId: user.id,
              entityType: "debt",
              remoteItems: mappedDebts,
              localItems: get().debts,
              pendingOutbox: activeOutbox,
              lastSyncedAt: lastSyncedCursor,
              getLabel: (item) => item.personName,
            });
            set({ debts: reconciledDebts });
          }
        } catch {}

        // 13. Sauvegarder le snapshot complet réconcilié dans IndexedDB + miroir localStorage
        const syncNowIso = probe.serverTime || new Date().toISOString();
        const cache = loadLocalCache(user.id) || {
          currency: get().currency,
          payDay: get().payDay,
          alertThreshold: get().alertThreshold,
          months: {},
          savingsGoals: get().savingsGoals,
          debts: get().debts,
        };
        cache.currency = get().currency;
        cache.payDay = get().payDay;
        cache.alertThreshold = get().alertThreshold;
        cache.notifications = get().notifications;
        cache.savingsGoals = get().savingsGoals;
        cache.debts = get().debts;
        cache.subscriptionPlan = get().subscriptionPlan;
        cache.billingCycle = get().billingCycle;
        cache.subscriptionExpiresAt = get().subscriptionExpiresAt;
        cache.subscriptionTrialEndsAt = get().subscriptionTrialEndsAt;
        cache.trialChoiceMadeAt = get().trialChoiceMadeAt;
        cache.subscriptionStatus = get().subscriptionStatus;
        cache.months[monthKey] = {
          baseSalary: get().baseSalary,
          income: get().income,
          incomeEntries: get().incomeEntries,
          categories: get().categories,
          transactions: get().transactions,
        };
        saveLocalCache(cache, user.id);

        const latestSnap = await readOfflineSnapshot(user.id);
        if (latestSnap) {
          if (latestSnap.months[monthKey]) {
            latestSnap.months[monthKey].budgetId = budget.id;
          }
          await writeOfflineSnapshot(user.id, {
            ...latestSnap,
            lastSyncedAt: syncNowIso,
            lastSuccessfulSyncAt: syncNowIso,
          });
        }

        set({ lastSyncedAt: syncNowIso });
      } else {
        await subscriptionPromise;
      }

      await get().refreshOfflineDiagnostics();
      void get().refreshNotifications();
    } catch (e) {
      console.warn("Notice: Offline or local mode active", e);
      await get().refreshOfflineDiagnostics();
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

    // Sauvegarde locale instantanée (localStorage + IndexedDB)
    const cache = loadLocalCache() || {
      currency: newCurrency,
      payDay: newPayDay,
      alertThreshold: newAlert,
      notifications: newNotifications,
      months: {},
      savingsGoals: get().savingsGoals,
      debts: get().debts,
    };
    cache.currency = newCurrency;
    cache.alertThreshold = newAlert;
    cache.payDay = newPayDay;
    cache.notifications = newNotifications;
    if (prefs.fullName !== undefined) cache.fullName = prefs.fullName;
    saveLocalCache(cache);

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "preferences",
      entityId: uid,
      coalesceKey: "preferences",
      type: "update_preferences",
      payload: {
        ...(prefs.alertThreshold !== undefined ? { alertThreshold: newAlert } : {}),
        ...(prefs.currency !== undefined ? { currency: newCurrency } : {}),
        ...(prefs.payDay !== undefined ? { payDay: newPayDay } : {}),
        ...(prefs.fullName !== undefined ? { fullName: prefs.fullName } : {}),
        ...(prefs.notifications !== undefined ? { notifications: newNotifications } : {}),
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();

    if (get().isOnline) {
      if (prefs.fullName !== undefined || prefs.notifications !== undefined) {
        supabase.auth
          .updateUser({
            data: {
              ...(prefs.fullName !== undefined ? { full_name: prefs.fullName } : {}),
              notifications: newNotifications,
            },
          })
          .catch(() => {});
      }
      void get().syncPendingQueue(false, true);
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

    // 1. Mise à jour synchrone en mémoire
    set({ baseSalary, income: totalIncome });

    // 2. Sauvegarde locale instantanée (en préservant budgetId et incomeEntries)
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
    const existingMonth = cache.months[monthKey];
    cache.months[monthKey] = {
      ...existingMonth,
      budgetId: existingMonth?.budgetId ?? get().budget_id,
      incomeEntries: existingMonth?.incomeEntries ?? get().incomeEntries,
      baseSalary,
      income: totalIncome,
      categories: get().categories,
      transactions: get().transactions,
    };
    saveLocalCache(cache);

    // 3. File d'attente persistante IndexedDB (coalescée) + synchronisation
    if (incomeDebounceTimer) clearTimeout(incomeDebounceTimer);
    incomeDebounceTimer = setTimeout(async () => {
      const uid = get().userId || activeUserId;
      if (!uid) return;
      await enqueueOutboxEntry(uid, {
        entityType: "primary_salary",
        entityId: monthKey,
        monthKey,
        coalesceKey: `primary_salary:${monthKey}`,
        type: "set_primary_salary",
        payload: {
          budgetId: get().budget_id,
          year,
          month,
          amount: baseSalary,
          received_date: new Date().toISOString().split("T")[0],
        },
        clientUpdatedAt: new Date().toISOString(),
      });
      await get().refreshOfflineDiagnostics();
      if (get().isOnline) {
        void get().syncPendingQueue(false, true);
      }
    }, 450);
  },

  setIncome: async (income) => {
    await get().setSalary(income);
  },

  addIncomeEntry: async (entry) => {
    const cleanAmount = Math.max(0, Number(entry.amount) || 0);
    if (cleanAmount <= 0) return;

    const entryId = ensureValidUuid(null);
    const entryDate = entry.date || new Date().toISOString().split("T")[0];
    const newItem: IncomeSourceEntry = {
      id: entryId,
      label: entry.label.trim() || entry.sourceType || "Revenu",
      sourceType: entry.sourceType || "Salaire",
      amount: cleanAmount,
      date: entryDate,
    };

    const currentEntries = get().incomeEntries;
    const hadImplicitBaseSalary = currentEntries.length === 0 && get().baseSalary > 0;
    const initialSalaryId = hadImplicitBaseSalary ? ensureValidUuid(null) : null;
    const baseEntries: IncomeSourceEntry[] = hadImplicitBaseSalary
      ? [
          {
            id: initialSalaryId!,
            label: "Salaire principal",
            sourceType: "Salaire",
            amount: get().baseSalary,
            date: entryDate,
          },
        ]
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
    const existingMonth = cache.months[monthKey];
    cache.months[monthKey] = {
      ...existingMonth,
      budgetId: existingMonth?.budgetId ?? get().budget_id,
      baseSalary: newBaseSalary,
      income: totalIncome,
      incomeEntries: updatedEntries,
      categories: get().categories,
      transactions: get().transactions,
    };
    saveLocalCache(cache);

    const uid = get().userId || activeUserId;
    if (!uid) return;

    if (hadImplicitBaseSalary && initialSalaryId) {
      await enqueueOutboxEntry(uid, {
        entityType: "income_entry",
        entityId: initialSalaryId,
        monthKey,
        type: "upsert_income_entry",
        payload: {
          id: initialSalaryId,
          monthly_budget_id: get().budget_id,
          year,
          month,
          label: "Salaire principal",
          source_type: "Salaire",
          amount: get().baseSalary,
          received_date: entryDate,
        },
        clientUpdatedAt: new Date().toISOString(),
      });
    }

    await enqueueOutboxEntry(uid, {
      entityType: "income_entry",
      entityId: entryId,
      monthKey,
      type: "upsert_income_entry",
      payload: {
        id: entryId,
        monthly_budget_id: get().budget_id,
        year,
        month,
        label: newItem.label,
        source_type: newItem.sourceType,
        amount: newItem.amount,
        received_date: newItem.date,
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
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

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "income_entry",
      entityId: id,
      monthKey,
      type: "delete_income_entry",
      payload: { id },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
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
      debts: curState.debts,
    };
    const existingMonth = cache.months[monthKey];
    cache.months[monthKey] = {
      ...existingMonth,
      budgetId: existingMonth?.budgetId ?? curState.budget_id,
      incomeEntries: existingMonth?.incomeEntries ?? curState.incomeEntries,
      baseSalary: curState.baseSalary,
      income: curState.income,
      categories: curState.categories,
      transactions: curState.transactions,
    };
    saveLocalCache(cache);

    const uid = curState.userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "primary_salary",
      entityId: monthKey,
      monthKey,
      coalesceKey: `primary_salary:${monthKey}`,
      type: "set_primary_salary",
      payload: {
        budgetId: curState.budget_id,
        year,
        month,
        amount: curState.baseSalary,
        received_date: new Date().toISOString().split("T")[0],
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    if (canModifyPaidFeature(curState)) {
      for (const cat of curState.categories) {
        if (!UUID_REGEX.test(cat.id)) continue;
        await enqueueOutboxEntry(uid, {
          entityType: "allocation",
          entityId: cat.id,
          monthKey,
          coalesceKey: `alloc:${monthKey}:${cat.id}`,
          type: "upsert_allocation",
          payload: {
            allocation_id: cat.allocation_id,
            budgetId: curState.budget_id,
            year,
            month,
            categoryId: cat.id,
            categoryName: cat.name,
            categoryColor: cat.color,
            amount: cat.amount,
          },
          clientUpdatedAt: new Date().toISOString(),
        });
      }
    }

    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  addCategory: async (cat) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const trimmedName = cat.name.trim();
    if (!trimmedName) return;

    const exists = get().categories.some((c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      return;
    }

    const catId = ensureValidUuid(cat.id);
    const newCategoryItem: Category = { ...cat, id: catId, name: trimmedName };

    const updated = deduplicateCategories([...get().categories, newCategoryItem]);
    set({ categories: updated });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].categories = updated;
      saveLocalCache(cache);
    }

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "category",
      entityId: catId,
      monthKey,
      type: "upsert_category",
      payload: {
        id: catId,
        name: trimmedName,
        color: cat.color || "bg-blue-500",
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    if ((Number(cat.amount) || 0) > 0) {
      await enqueueOutboxEntry(uid, {
        entityType: "allocation",
        entityId: catId,
        monthKey,
        coalesceKey: `alloc:${monthKey}:${catId}`,
        type: "upsert_allocation",
        payload: {
          budgetId: get().budget_id,
          year,
          month,
          categoryId: catId,
          categoryName: trimmedName,
          categoryColor: cat.color || "bg-blue-500",
          amount: Number(cat.amount) || 0,
        },
        clientUpdatedAt: new Date().toISOString(),
      });
    }

    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  removeCategory: async (id) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const updated = get().categories.filter((c) => c.id !== id);
    set({ categories: updated });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].categories = updated;
      saveLocalCache(cache);
    }

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "category",
      entityId: id,
      monthKey,
      type: "delete_category",
      payload: { id },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  updateCategory: async (id, updates) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const updated = get().categories.map((c) => (c.id === id ? { ...c, ...updates } : c));
    set({ categories: updated });

    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].categories = updated;
      saveLocalCache(cache);
    }

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "category",
      entityId: id,
      monthKey,
      coalesceKey: `upd_cat:${id}`,
      type: "update_category",
      payload: { id, ...updates },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  updateCategoryAmount: async (id, amount) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
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
      const uid = get().userId || activeUserId;
      if (!uid) return;
      const category = get().categories.find((c) => c.id === id);
      await enqueueOutboxEntry(uid, {
        entityType: "allocation",
        entityId: id,
        monthKey,
        coalesceKey: `alloc:${monthKey}:${id}`,
        type: "upsert_allocation",
        payload: {
          allocation_id: category?.allocation_id,
          budgetId: get().budget_id,
          year,
          month,
          categoryId: id,
          categoryName: category?.name,
          categoryColor: category?.color,
          amount,
        },
        clientUpdatedAt: new Date().toISOString(),
      });
      await get().refreshOfflineDiagnostics();
      if (get().isOnline) {
        void get().syncPendingQueue(false, true);
      }
    }, 450);
  },

  addTransaction: async (tx) => {
    const isInc = tx.type === "income" || tx.type === "income_adjustment";
    const normalizedType: "income" | "expense" = isInc ? "income" : "expense";
    const assignedCatName = (tx.category || (isInc ? "Revenu" : "Autre (Hors Budget)")).trim();
    const txId = ensureValidUuid(tx.id);
    const transactionItem: Transaction = {
      ...tx,
      id: txId,
      type: normalizedType,
      category: assignedCatName,
      pendingSync: true,
    };

    const newTransactions = [transactionItem, ...get().transactions];
    const newIncome = isInc ? get().income + tx.amount : get().income;

    let updatedCategories = get().categories;
    let newlyCreatedCategory: Category | null = null;
    let updatedSavingsAllocationCat: Category | null = null;

    const isSavingsCat =
      assignedCatName.toLowerCase() === "épargne" ||
      assignedCatName.toLowerCase() === "epargne" ||
      tx.label.trim().toLowerCase().startsWith("épargne :");

    if (
      canModifyPaidFeature(get()) &&
      !isInc &&
      assignedCatName &&
      assignedCatName !== "Autre (Hors Budget)"
    ) {
      const catSpentAfter = getSpentByCategory(newTransactions, assignedCatName);
      const catExists = updatedCategories.some(
        (c) => c.name.trim().toLowerCase() === assignedCatName.toLowerCase()
      );
      if (!catExists) {
        const newCatId = ensureValidUuid(null);
        const newCat: Category = {
          id: newCatId,
          name: assignedCatName,
          amount: isSavingsCat ? catSpentAfter : 0,
          color: isSavingsCat ? "bg-emerald-600" : "bg-blue-500",
        };
        newlyCreatedCategory = newCat;
        updatedCategories = deduplicateCategories([...updatedCategories, newCat]);
      } else if (isSavingsCat) {
        updatedCategories = updatedCategories.map((c) => {
          if (c.name.trim().toLowerCase() === assignedCatName.toLowerCase()) {
            const nextAmount = Math.max(Number(c.amount) || 0, catSpentAfter);
            if (nextAmount !== Number(c.amount)) {
              updatedSavingsAllocationCat = { ...c, amount: nextAmount };
            }
            return { ...c, amount: nextAmount };
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

    // Sauvegarde locale instantanée (localStorage + IndexedDB)
    const { year, month } = get().activeMonth;
    const monthKey = getMonthKey(year, month);
    const cache = loadLocalCache();
    if (cache && cache.months[monthKey]) {
      cache.months[monthKey].transactions = newTransactions;
      cache.months[monthKey].income = newIncome;
      cache.months[monthKey].categories = updatedCategories;
      saveLocalCache(cache);
    }

    const uid = get().userId || activeUserId;
    if (!uid) return;

    if (newlyCreatedCategory) {
      await enqueueOutboxEntry(uid, {
        entityType: "category",
        entityId: newlyCreatedCategory.id,
        monthKey,
        type: "upsert_category",
        payload: {
          id: newlyCreatedCategory.id,
          name: newlyCreatedCategory.name,
          color: newlyCreatedCategory.color,
        },
        clientUpdatedAt: new Date().toISOString(),
      });
      if (newlyCreatedCategory.amount > 0) {
        await enqueueOutboxEntry(uid, {
          entityType: "allocation",
          entityId: newlyCreatedCategory.id,
          monthKey,
          coalesceKey: `alloc:${monthKey}:${newlyCreatedCategory.id}`,
          type: "upsert_allocation",
          payload: {
            budgetId: get().budget_id,
            year,
            month,
            categoryId: newlyCreatedCategory.id,
            categoryName: newlyCreatedCategory.name,
            categoryColor: newlyCreatedCategory.color,
            amount: newlyCreatedCategory.amount,
          },
          clientUpdatedAt: new Date().toISOString(),
        });
      }
    } else if (updatedSavingsAllocationCat) {
      const catToSync = updatedSavingsAllocationCat as Category;
      await enqueueOutboxEntry(uid, {
        entityType: "allocation",
        entityId: catToSync.id,
        monthKey,
        coalesceKey: `alloc:${monthKey}:${catToSync.id}`,
        type: "upsert_allocation",
        payload: {
          allocation_id: catToSync.allocation_id,
          budgetId: get().budget_id,
          year,
          month,
          categoryId: catToSync.id,
          categoryName: catToSync.name,
          categoryColor: catToSync.color,
          amount: catToSync.amount,
        },
        clientUpdatedAt: new Date().toISOString(),
      });
    }

    let category_id: string | null = null;
    if (!isInc) {
      const cat = get().categories.find((c) => c.name.toLowerCase() === assignedCatName.toLowerCase());
      if (cat && UUID_REGEX.test(cat.id)) category_id = cat.id;
    }

    await enqueueOutboxEntry(uid, {
      entityType: "transaction",
      entityId: txId,
      monthKey,
      type: "upsert_transaction",
      payload: {
        id: txId,
        monthly_budget_id: get().budget_id,
        year,
        month,
        category_id,
        amount: tx.amount,
        description: tx.label,
        transaction_date: tx.date,
        type: isInc ? "income_adjustment" : "expense",
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  removeTransaction: async (id) => {
    const tx = get().transactions.find((t) => t.id === id);
    const newTransactions = get().transactions.filter((t) => t.id !== id);
    let newIncome = get().income;
    if (tx && (tx.type === "income" || tx.type === "income_adjustment")) {
      newIncome = Math.max(0, newIncome - tx.amount);
    }

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

      const uid = get().userId || activeUserId;
      if (!uid) return;

      await enqueueOutboxEntry(uid, {
        entityType: "transaction",
        entityId: id,
        monthKey,
        type: "delete_transaction",
        payload: { id },
        clientUpdatedAt: new Date().toISOString(),
      });

      if (syncedPaymentIdToRemove && syncedDebtToUpdate) {
        const dUpd = syncedDebtToUpdate as DebtItem;
        await enqueueOutboxEntry(uid, {
          entityType: "debt_payment",
          entityId: syncedPaymentIdToRemove,
          type: "delete_debt_payment",
          payload: {
            id: syncedPaymentIdToRemove,
            debtId: dUpd.id,
            remainingAmount: dUpd.remainingAmount,
            debtStatus: dUpd.status,
          },
          clientUpdatedAt: new Date().toISOString(),
        });
      }

      if (syncedContribIdToRemove && syncedGoalToUpdate) {
        const gUpd = syncedGoalToUpdate as SavingsGoal;
        await enqueueOutboxEntry(uid, {
          entityType: "savings_contribution",
          entityId: syncedContribIdToRemove,
          type: "delete_savings_contribution",
          payload: {
            id: syncedContribIdToRemove,
            goalId: gUpd.id,
            newCurrent: gUpd.current,
            goalStatus: gUpd.status,
          },
          clientUpdatedAt: new Date().toISOString(),
        });
      }

      await get().refreshOfflineDiagnostics();
      if (get().isOnline) {
        void get().syncPendingQueue(false, true);
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

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "transaction",
      entityId: id,
      monthKey,
      type: "delete_transaction",
      payload: { id },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  duplicatePreviousMonth: async () => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return { prevMonthName: "", allocationsCount: 0, income: 0 };
    }
    const { year, month } = get().activeMonth;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevMonthName = new Date(prevYear, prevMonth - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const prevKey = getMonthKey(prevYear, prevMonth);
    const currentKey = getMonthKey(year, month);

    const uid = get().userId || activeUserId;
    const cache = loadLocalCache();
    let prevMonthData = cache?.months?.[prevKey];
    if (!prevMonthData && uid) {
      const idbSnap = await readOfflineSnapshot(uid);
      prevMonthData = idbSnap?.months?.[prevKey];
    }

    let copiedIncome = 0;
    let allocationsCount = 0;
    let duplicatedCats: Category[] = get().categories;

    if (prevMonthData && prevMonthData.categories.length > 0) {
      copiedIncome = prevMonthData.baseSalary || prevMonthData.income;
      duplicatedCats = prevMonthData.categories.map((c) => ({ ...c, allocation_id: undefined }));
      allocationsCount = duplicatedCats.filter((c) => c.amount > 0).length;

      set({
        baseSalary: copiedIncome,
        income: copiedIncome,
        categories: duplicatedCats,
      });

      const targetCache = cache || {
        currency: get().currency,
        payDay: get().payDay,
        alertThreshold: get().alertThreshold,
        months: {},
        savingsGoals: get().savingsGoals,
        debts: get().debts,
      };
      const existingCurMonth = targetCache.months[currentKey];
      targetCache.months[currentKey] = {
        ...existingCurMonth,
        budgetId: existingCurMonth?.budgetId ?? get().budget_id,
        incomeEntries: existingCurMonth?.incomeEntries ?? get().incomeEntries,
        baseSalary: copiedIncome,
        income: copiedIncome,
        categories: duplicatedCats,
        transactions: get().transactions,
      };
      saveLocalCache(targetCache);
    } else if (get().isOnline) {
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
            .select("*")
            .eq("monthly_budget_id", prevBudget.id);

          const { data: prevAllocations } = await supabase
            .from("budget_allocations")
            .select("*")
            .eq("monthly_budget_id", prevBudget.id);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const activePrevIncomes = (prevIncomes || []).filter((i: any) => !i.deleted_at);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const activePrevAllocations = (prevAllocations || []).filter((a: any) => !a.deleted_at);

          if (activePrevIncomes.length > 0) {
            copiedIncome = activePrevIncomes.reduce((s, i) => s + Number(i.amount), 0);
          }

          if (activePrevAllocations.length > 0) {
            allocationsCount = activePrevAllocations.length;
            duplicatedCats = get().categories.map((c) => {
              const prev = activePrevAllocations.find((a) => a.category_id === c.id);
              return { ...c, allocation_id: undefined, amount: prev ? Number(prev.allocated_amount) : c.amount };
            });
          }

          set({
            baseSalary: copiedIncome,
            income: copiedIncome,
            categories: duplicatedCats,
          });
        }
      }
    }

    if (uid && (copiedIncome > 0 || allocationsCount > 0)) {
      await enqueueOutboxEntry(uid, {
        entityType: "primary_salary",
        entityId: currentKey,
        monthKey: currentKey,
        coalesceKey: `primary_salary:${currentKey}`,
        type: "set_primary_salary",
        payload: {
          budgetId: get().budget_id,
          year,
          month,
          amount: copiedIncome,
          received_date: new Date().toISOString().split("T")[0],
        },
        clientUpdatedAt: new Date().toISOString(),
      });

      for (const cat of duplicatedCats) {
        if (!UUID_REGEX.test(cat.id)) continue;
        await enqueueOutboxEntry(uid, {
          entityType: "allocation",
          entityId: cat.id,
          monthKey: currentKey,
          coalesceKey: `alloc:${currentKey}:${cat.id}`,
          type: "upsert_allocation",
          payload: {
            budgetId: get().budget_id,
            year,
            month,
            categoryId: cat.id,
            categoryName: cat.name,
            categoryColor: cat.color,
            amount: cat.amount,
          },
          clientUpdatedAt: new Date().toISOString(),
        });
      }

      await get().refreshOfflineDiagnostics();
      if (get().isOnline) {
        void get().syncPendingQueue(false, true);
      }
    }

    return {
      prevMonthName,
      allocationsCount,
      income: copiedIncome,
    };
  },

  addSavingsGoal: async (goal) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const goalId = ensureValidUuid(null);
    const newGoal: SavingsGoal = {
      id: goalId,
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

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "savings_goal",
      entityId: goalId,
      type: "upsert_savings_goal",
      payload: {
        id: goalId,
        name: goal.name,
        target_amount: goal.target,
        current_amount: 0,
        color: goal.color || "bg-blue-500",
        target_date: goal.target_date || null,
        status: "active",
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  removeSavingsGoal: async (id) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const updated = get().savingsGoals.filter((g) => g.id !== id);
    set({ savingsGoals: updated });

    const cache = loadLocalCache();
    if (cache) {
      cache.savingsGoals = updated;
      saveLocalCache(cache);
    }

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "savings_goal",
      entityId: id,
      type: "delete_savings_goal",
      payload: { id },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  updateSavingsGoalStatus: async (id, status) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const updated = get().savingsGoals.map((g) => (g.id === id ? { ...g, status } : g));
    set({ savingsGoals: updated });

    const cache = loadLocalCache();
    if (cache) {
      cache.savingsGoals = updated;
      saveLocalCache(cache);
    }

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "savings_goal",
      entityId: id,
      coalesceKey: `goal_status:${id}`,
      type: "update_savings_goal_status",
      payload: { id, status },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  addSavingsContribution: async (goalId, amount, notes, date) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const goal = get().savingsGoals.find((g) => g.id === goalId);
    if (!goal) return;

    const contributionDate = date || new Date().toISOString().split("T")[0];
    const txId = ensureValidUuid(null);
    const contribId = ensureValidUuid(null);
    const contribItem: SavingsContribution = {
      id: contribId,
      amount,
      date: contributionDate,
      notes: notes || undefined,
      linkedTransactionId: txId,
    };

    const newCurrent = goal.current + amount;
    const nextGoalStatus: "active" | "completed" | "paused" =
      newCurrent >= goal.target ? "completed" : goal.status;
    const updatedGoals = get().savingsGoals.map((g) => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        current: newCurrent,
        status: nextGoalStatus,
        contributions: [contribItem, ...(g.contributions || [])],
      };
    });

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
      pendingSync: true,
    };

    const updatedTransactions = [linkedTx, ...get().transactions];

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
        id: ensureValidUuid(null),
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

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "savings_contribution",
      entityId: contribId,
      type: "upsert_savings_contribution",
      payload: {
        id: contribId,
        savings_goal_id: goalId,
        amount,
        contribution_date: contributionDate,
        notes: notes || null,
        newCurrent,
        goalStatus: nextGoalStatus,
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    await enqueueOutboxEntry(uid, {
      entityType: "transaction",
      entityId: txId,
      monthKey,
      type: "upsert_transaction",
      payload: {
        id: txId,
        monthly_budget_id: get().budget_id,
        year,
        month,
        category_id: null,
        amount,
        description: txLabel,
        transaction_date: contributionDate,
        type: "expense",
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  removeSavingsContribution: async (contributionId, goalId) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
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

    const uid = get().userId || activeUserId;
    if (!uid) return;

    const updatedGoal = updatedGoals.find((g) => g.id === goalId);
    await enqueueOutboxEntry(uid, {
      entityType: "savings_contribution",
      entityId: contributionId,
      type: "delete_savings_contribution",
      payload: {
        id: contributionId,
        goalId,
        newCurrent: updatedGoal?.current,
        goalStatus: updatedGoal?.status,
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    if (txToRemoveId) {
      await enqueueOutboxEntry(uid, {
        entityType: "transaction",
        entityId: txToRemoveId,
        monthKey,
        type: "delete_transaction",
        payload: { id: txToRemoveId },
        clientUpdatedAt: new Date().toISOString(),
      });
    }

    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  addSavingsAmount: async (id, amount) => {
    await get().addSavingsContribution(id, amount);
  },

  addDebt: async (debt) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const cleanAmount = Math.max(0, Number(debt.totalAmount) || 0);
    if (!debt.personName.trim() || cleanAmount <= 0) return;

    const debtId = ensureValidUuid(null);
    const newDebt: DebtItem = {
      id: debtId,
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

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "debt",
      entityId: debtId,
      type: "upsert_debt",
      payload: {
        id: debtId,
        type: newDebt.type,
        person_name: newDebt.personName,
        phone: newDebt.phone || null,
        total_amount: newDebt.totalAmount,
        remaining_amount: newDebt.remainingAmount,
        due_date: newDebt.dueDate || null,
        status: "pending",
        notes: newDebt.notes || null,
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  removeDebt: async (id) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const updatedDebts = get().debts.filter((d) => d.id !== id);
    set({ debts: updatedDebts });

    const cache = loadLocalCache();
    if (cache) {
      cache.debts = updatedDebts;
      saveLocalCache(cache);
    }

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "debt",
      entityId: id,
      type: "delete_debt",
      payload: { id },
      clientUpdatedAt: new Date().toISOString(),
    });
    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  addDebtPayment: async (debtId, amount, notes, date) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
    const debt = get().debts.find((d) => d.id === debtId);
    if (!debt) return;

    const cleanAmount = Math.max(0, Number(amount) || 0);
    if (cleanAmount <= 0) return;

    const paymentDate = date || new Date().toISOString().split("T")[0];
    const txId = ensureValidUuid(null);
    const paymentId = ensureValidUuid(null);
    const paymentItem: DebtPaymentItem = {
      id: paymentId,
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
      pendingSync: true,
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
        budgetId: get().budget_id,
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

    const uid = get().userId || activeUserId;
    if (!uid) return;

    await enqueueOutboxEntry(uid, {
      entityType: "debt_payment",
      entityId: paymentId,
      type: "upsert_debt_payment",
      payload: {
        id: paymentId,
        debt_id: debtId,
        amount: cleanAmount,
        payment_date: paymentDate,
        notes: notes?.trim() || null,
        remainingAmount: newRemaining,
        debtStatus: newStatus,
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    await enqueueOutboxEntry(uid, {
      entityType: "transaction",
      entityId: txId,
      monthKey,
      type: "upsert_transaction",
      payload: {
        id: txId,
        monthly_budget_id: get().budget_id,
        year,
        month,
        category_id: null,
        amount: cleanAmount,
        description: txLabel,
        transaction_date: paymentDate,
        type: isReceivable ? "income_adjustment" : "expense",
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },

  removeDebtPayment: async (paymentId, debtId) => {
    if (!canModifyPaidFeature(get())) {
      toast.error(LOCKED_FEATURE_TOAST);
      return;
    }
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

    const uid = get().userId || activeUserId;
    if (!uid) return;

    const updatedDebt = updatedDebts.find((d) => d.id === debtId);
    await enqueueOutboxEntry(uid, {
      entityType: "debt_payment",
      entityId: paymentId,
      type: "delete_debt_payment",
      payload: {
        id: paymentId,
        debtId,
        remainingAmount: updatedDebt?.remainingAmount,
        debtStatus: updatedDebt?.status,
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    if (txToRemoveId) {
      await enqueueOutboxEntry(uid, {
        entityType: "transaction",
        entityId: txToRemoveId,
        monthKey,
        type: "delete_transaction",
        payload: { id: txToRemoveId },
        clientUpdatedAt: new Date().toISOString(),
      });
    }

    await get().refreshOfflineDiagnostics();
    if (get().isOnline) {
      void get().syncPendingQueue(false, true);
    }
  },
}));
