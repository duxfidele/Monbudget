"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Save, 
  User, 
  Bell, 
  Shield, 
  LogOut, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Calendar,
  Wallet,
  Sun,
  Moon,
  Monitor,
  Palette,
  Download,
  RefreshCw,
  FileJson,
  Database,
  CreditCard,
  Crown,
  Clock,
  AlertTriangle,
  Upload,
  HardDrive,
  ArrowLeftRight,
  Smartphone,
  Cloud,
  Check,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store/ui-store";
import type { ConflictRecord } from "@/lib/offline/db";
import { InstallButton } from "@/components/pwa/install-button";
import { buildFullAccountExport, downloadJsonFile } from "@/lib/utils/account-export";
import { getUserStorageKey } from "@/lib/utils/security";
import { SubscriptionPlansWidget } from "@/components/payments/subscription-plans-widget";
import {
  getPlanCatalog,
  getSubscriptionCountdownInfo,
  PaidSubscriptionPlanId,
} from "@/lib/moneriz-plans";

type TabType = "profile" | "subscription" | "appearance" | "notifications" | "security";

function getEntityTypeLabel(entityType: ConflictRecord["entityType"]): string {
  switch (entityType) {
    case "transaction":
      return "Transaction";
    case "income_entry":
      return "Revenu";
    case "savings_goal":
      return "Épargne";
    case "debt":
      return "Dette / Créance";
    default:
      return entityType;
  }
}

function getAutoResolutionLabel(resolution: ConflictRecord["resolution"]): string {
  switch (resolution) {
    case "local_wins":
      return "Décision initiale : version locale conservée";
    case "remote_wins":
      return "Décision initiale : version serveur conservée";
    case "delete_wins":
      return "Décision initiale : suppression appliquée";
    case "merged":
      return "Décision initiale : fusionnée";
    default:
      return "Révision manuelle requise";
  }
}

function formatConflictTimestamp(iso?: string): string {
  if (!iso) return "Date inconnue";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date inconnue";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConflictVersionLines(
  entityType: ConflictRecord["entityType"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any> | undefined,
  currency: string
): { isDeleted: boolean; lines: Array<{ key: string; value: string }> } {
  if (!data) {
    return { isDeleted: false, lines: [] };
  }
  const isDeleted = Boolean(data._deleted || data.deletedAt);
  const cur = currency || "FCFA";
  const lines: Array<{ key: string; value: string }> = [];

  if (entityType === "transaction") {
    const lbl = data.label ?? data.description;
    if (lbl) lines.push({ key: "Libellé", value: String(lbl) });
    if (data.amount !== undefined) {
      lines.push({ key: "Montant", value: `${Number(data.amount).toLocaleString("fr-FR")} ${cur}` });
    }
    if (data.category) lines.push({ key: "Catégorie", value: String(data.category) });
    const dt = data.date ?? data.transaction_date;
    if (dt) lines.push({ key: "Date", value: String(dt) });
    if (data.type) {
      lines.push({
        key: "Type",
        value: data.type === "income" || data.type === "income_adjustment" ? "Revenu" : "Dépense",
      });
    }
  } else if (entityType === "income_entry") {
    if (data.label) lines.push({ key: "Libellé", value: String(data.label) });
    const st = data.sourceType ?? data.source_type;
    if (st) lines.push({ key: "Source", value: String(st) });
    if (data.amount !== undefined) {
      lines.push({ key: "Montant", value: `${Number(data.amount).toLocaleString("fr-FR")} ${cur}` });
    }
    const dt = data.date ?? data.received_date;
    if (dt) lines.push({ key: "Date", value: String(dt) });
  } else if (entityType === "savings_goal") {
    if (data.name) lines.push({ key: "Objectif", value: String(data.name) });
    const tgt = data.target ?? data.target_amount;
    if (tgt !== undefined) {
      lines.push({ key: "Cible", value: `${Number(tgt).toLocaleString("fr-FR")} ${cur}` });
    }
    const curAmt = data.current ?? data.current_amount;
    if (curAmt !== undefined) {
      lines.push({ key: "Épargné", value: `${Number(curAmt).toLocaleString("fr-FR")} ${cur}` });
    }
    if (data.status) lines.push({ key: "Statut", value: String(data.status) });
  } else if (entityType === "debt") {
    const pn = data.personName ?? data.person_name;
    if (pn) lines.push({ key: "Personne", value: String(pn) });
    const tot = data.totalAmount ?? data.total_amount;
    if (tot !== undefined) {
      lines.push({ key: "Total", value: `${Number(tot).toLocaleString("fr-FR")} ${cur}` });
    }
    const rem = data.remainingAmount ?? data.remaining_amount;
    if (rem !== undefined) {
      lines.push({ key: "Reste dû", value: `${Number(rem).toLocaleString("fr-FR")} ${cur}` });
    }
    if (data.status) lines.push({ key: "Statut", value: String(data.status) });
  }

  return { isDeleted, lines };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [highlightedPlan, setHighlightedPlan] = useState<PaidSubscriptionPlanId | undefined>(
    undefined
  );
  const [isChoosingFree, setIsChoosingFree] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const syncFromUrlAndHash = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as TabType | null;
      if (
        tabParam &&
        ["profile", "subscription", "appearance", "notifications", "security"].includes(tabParam)
      ) {
        setActiveTab(tabParam);
      }
      const planParam = params.get("plan");
      if (planParam === "personal" || planParam === "business") {
        setHighlightedPlan(planParam);
      }
      if (window.location.hash === "#conflicts-review") {
        setActiveTab("security");
        setTimeout(() => {
          document
            .getElementById("conflicts-review")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    };

    const handleOpenConflicts = () => {
      setActiveTab("security");
      setTimeout(() => {
        document
          .getElementById("conflicts-review")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    };

    syncFromUrlAndHash();
    window.addEventListener("hashchange", syncFromUrlAndHash);
    window.addEventListener("popstate", syncFromUrlAndHash);
    window.addEventListener("monbudget:open-conflicts-review", handleOpenConflicts);
    return () => {
      window.removeEventListener("hashchange", syncFromUrlAndHash);
      window.removeEventListener("popstate", syncFromUrlAndHash);
      window.removeEventListener("monbudget:open-conflicts-review", handleOpenConflicts);
    };
  }, []);

  // Profile data
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  // Preferences from store
  const { 
    alertThreshold, 
    currency: storeCurrency, 
    payDay: storePayDay, 
    notifications: storeNotifications,
    isOnline,
    syncStatus,
    pendingSyncCount,
    lastSyncedAt,
    unresolvedConflictsCount,
    syncConflicts,
    resolveConflictChoice,
    syncPendingQueue,
    exportOfflineBackup,
    restoreOfflineBackup,
    updatePreferences, 
    updateNotifications,
    resetStore,
    categories,
    transactions,
    income,
    baseSalary,
    incomeEntries,
    savingsGoals,
    debts,
    activeMonth,
    isAdminUser,
    subscriptionHydrated,
    subscriptionPlan,
    billingCycle,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    subscriptionStatus,
    refreshSubscription,
    chooseFreePlan,
  } = useUIStore();

  const subscriptionCountdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: isAdminUser,
  });
  const catalog = getPlanCatalog();

  const [localAlert, setLocalAlert] = useState(80);
  const [localCurrency, setLocalCurrency] = useState("FCFA");
  const [localPayDay, setLocalPayDay] = useState(28);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Notifications settings fonctionnels et persistés
  const [notifBudgetAlert, setNotifBudgetAlert] = useState(true);
  const [notifBudgetAlertThreshold, setNotifBudgetAlertThreshold] = useState(80);
  const [notifPayDayReminder, setNotifPayDayReminder] = useState(true);
  const [notifPayDayReminderDays, setNotifPayDayReminderDays] = useState(7);
  const [notifWeeklySummary, setNotifWeeklySummary] = useState(false);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

  // Security (password)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  // Load authenticated user and profile on mount
  useEffect(() => {
    async function loadUserData() {
      setIsLoadingUser(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setEmail(user.email || "");
          setUserId(user.id);
          
          // Fetch profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (profile) {
            setName(profile.full_name || user.user_metadata?.full_name || "");
            const pCur = profile.currency && profile.currency.trim() ? profile.currency.trim() : "FCFA";
            setLocalCurrency(pCur);
            if (profile.pay_day) setLocalPayDay(Number(profile.pay_day));
            if (profile.alert_threshold_percent) {
              setLocalAlert(Number(profile.alert_threshold_percent));
              setNotifBudgetAlertThreshold(Number(profile.alert_threshold_percent));
            }

            // Charger les préférences de notifications distantes
            const remoteNotifs = profile.notifications || user.user_metadata?.notifications;
            if (remoteNotifs) {
              if (remoteNotifs.budgetAlert !== undefined) setNotifBudgetAlert(Boolean(remoteNotifs.budgetAlert));
              if (remoteNotifs.budgetAlertThreshold !== undefined) setNotifBudgetAlertThreshold(Number(remoteNotifs.budgetAlertThreshold));
              if (remoteNotifs.payDayReminder !== undefined) setNotifPayDayReminder(Boolean(remoteNotifs.payDayReminder));
              if (remoteNotifs.payDayReminderDays !== undefined) setNotifPayDayReminderDays(Number(remoteNotifs.payDayReminderDays));
              if (remoteNotifs.weeklySummary !== undefined) setNotifWeeklySummary(Boolean(remoteNotifs.weeklySummary));
            }
          } else {
            setName(user.user_metadata?.full_name || "");
          }
        }
      } catch (err) {
        console.warn("Could not load user profile:", err);
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUserData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync with store when store loads
  useEffect(() => {
    if (alertThreshold) {
      setLocalAlert(alertThreshold);
      setNotifBudgetAlertThreshold(alertThreshold);
    }
    if (storeCurrency) setLocalCurrency(storeCurrency);
    else setLocalCurrency("FCFA");
    if (storePayDay) setLocalPayDay(storePayDay);
    if (storeNotifications) {
      if (storeNotifications.budgetAlert !== undefined) setNotifBudgetAlert(storeNotifications.budgetAlert);
      if (storeNotifications.budgetAlertThreshold !== undefined) setNotifBudgetAlertThreshold(storeNotifications.budgetAlertThreshold);
      if (storeNotifications.payDayReminder !== undefined) setNotifPayDayReminder(storeNotifications.payDayReminder);
      if (storeNotifications.payDayReminderDays !== undefined) setNotifPayDayReminderDays(storeNotifications.payDayReminderDays);
      if (storeNotifications.weeklySummary !== undefined) setNotifWeeklySummary(storeNotifications.weeklySummary);
    }
  }, [alertThreshold, storeCurrency, storePayDay, storeNotifications]);

  const handleLogout = async () => {
    try {
      resetStore();
      await supabase.auth.signOut();
      toast.success("Déconnexion réussie");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  const handleSaveProfileAndPreferences = async () => {
    setIsSavingPrefs(true);
    try {
      await updatePreferences({
        fullName: name.trim(),
        alertThreshold: localAlert,
        currency: localCurrency,
        payDay: localPayDay,
      });
      toast.success("Profil et préférences mis à jour avec succès !", {
        description: `Devise : ${localCurrency} | Jour de paie : ${localPayDay} du mois | Seuil : ${localAlert}%`,
      });
    } catch (e: any) {
      toast.error("Erreur lors de la sauvegarde", {
        description: e.message || "Impossible de sauvegarder vos préférences.",
      });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSavingNotifs(true);
    try {
      await updateNotifications({
        budgetAlert: notifBudgetAlert,
        budgetAlertThreshold: notifBudgetAlertThreshold,
        payDayReminder: notifPayDayReminder,
        payDayReminderDays: notifPayDayReminderDays,
        weeklySummary: notifWeeklySummary,
      });

      // Synchroniser également le seuil général dans les préférences
      if (notifBudgetAlertThreshold !== alertThreshold) {
        await updatePreferences({ alertThreshold: notifBudgetAlertThreshold });
      }

      toast.success("Préférences de notifications enregistrées !", {
        description: `Alertes de seuil (${notifBudgetAlert ? "Activées à " + notifBudgetAlertThreshold + "%" : "Désactivées"}) | Rappel paie (${notifPayDayReminder ? "Activé à J-" + notifPayDayReminderDays : "Désactivé"}).`,
      });
    } catch (e: any) {
      toast.error("Erreur de sauvegarde", {
        description: e.message || "Impossible d'enregistrer vos paramètres de notifications.",
      });
    } finally {
      setIsSavingNotifs(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Mot de passe mis à jour avec succès !");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error("Impossible de modifier le mot de passe", {
        description: err.message || "Une erreur est survenue.",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isRestoringOffline, setIsRestoringOffline] = useState(false);
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);
  const offlineBackupInputRef = useRef<HTMLInputElement | null>(null);

  const handleResolveConflict = async (
    conflictId: string,
    choice: "keep_local" | "keep_remote" | "dismiss"
  ) => {
    setResolvingConflictId(conflictId);
    try {
      await resolveConflictChoice(conflictId, choice);
    } finally {
      setResolvingConflictId(null);
    }
  };

  const handleRestoreOfflineFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoringOffline(true);
    try {
      const text = await file.text();
      await restoreOfflineBackup(text);
    } finally {
      setIsRestoringOffline(false);
      e.target.value = "";
    }
  };

  const handleExportAllData = () => {
    setIsExportingAll(true);
    try {
      const storageKey = getUserStorageKey(userId);
      const rawCache = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      const cache = rawCache ? JSON.parse(rawCache) : null;

      const currentMonthKey = `${activeMonth.year}-${String(activeMonth.month).padStart(2, "0")}`;
      const currentMonthData = {
        baseSalary: baseSalary || income || 0,
        income,
        incomeEntries,
        categories,
        transactions,
      };

      const fullExport = buildFullAccountExport({
        userId,
        userEmail: email,
        fullName: name,
        currency: storeCurrency || localCurrency,
        payDay: storePayDay || localPayDay,
        alertThreshold: alertThreshold || localAlert,
        notifications: storeNotifications,
        cache,
        currentMonthKey,
        currentMonthData,
        savingsGoals,
        debts,
      });

      const todayStr = new Date().toISOString().split("T")[0];
      const success = downloadJsonFile(
        fullExport,
        `MonBudget_Sauvegarde_Integrale_${todayStr}.json`
      );

      if (success) {
        toast.success("Sauvegarde intégrale téléchargée avec succès !", {
          description: `${fullExport.exportMetadata.totalMonthsExported} mois et ${fullExport.exportMetadata.totalTransactionsExported} transactions consolidés.`,
        });
      } else {
        toast.error("Impossible de générer le fichier de téléchargement.");
      }
    } catch (err: any) {
      console.error("Erreur export intégral :", err);
      toast.error("Erreur lors de la création de la sauvegarde.");
    } finally {
      setIsExportingAll(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* En-tête */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mb-1 border border-slate-200 dark:border-slate-700">
          <User className="h-3.5 w-3.5 text-[#1E3A5F] dark:text-sky-400" />
          <span>Configuration du compte</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Paramètres
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">
          Gérez votre profil, vos préférences de budget et la sécurité de votre compte.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Navigation des Onglets (Sidebar interne sur desktop, barre défilante sur mobile) */}
        <div className="md:col-span-1 min-w-0 flex md:flex-col items-center md:items-stretch gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <Button 
            variant={activeTab === "profile" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("profile")}
            className={`whitespace-nowrap shrink-0 md:w-full justify-start font-medium text-xs sm:text-sm transition-all ${
              activeTab === "profile" 
                ? "bg-[#1E3A5F] dark:bg-sky-600 text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <User className="mr-2 h-4 w-4 shrink-0" />
            <span>Mon Profil & Budget</span>
          </Button>

          <Button 
            variant={activeTab === "subscription" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("subscription")}
            className={`whitespace-nowrap shrink-0 md:w-full justify-start font-medium text-xs sm:text-sm transition-all ${
              activeTab === "subscription" 
                ? "bg-[#1E3A5F] dark:bg-sky-600 text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <CreditCard className="mr-2 h-4 w-4 shrink-0" />
            <span>Mon Abonnement</span>
          </Button>

          <Button 
            variant={activeTab === "appearance" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("appearance")}
            className={`whitespace-nowrap shrink-0 md:w-full justify-start font-medium text-xs sm:text-sm transition-all ${
              activeTab === "appearance" 
                ? "bg-[#1E3A5F] dark:bg-sky-600 text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Palette className="mr-2 h-4 w-4 shrink-0" />
            <span>Apparence & Thème</span>
          </Button>

          <Button 
            variant={activeTab === "notifications" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("notifications")}
            className={`whitespace-nowrap shrink-0 md:w-full justify-start font-medium text-xs sm:text-sm transition-all ${
              activeTab === "notifications" 
                ? "bg-[#1E3A5F] dark:bg-sky-600 text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Bell className="mr-2 h-4 w-4 shrink-0" />
            <span>Notifications</span>
          </Button>

          <Button 
            variant={activeTab === "security" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("security")}
            className={`whitespace-nowrap shrink-0 md:w-full justify-start font-medium text-xs sm:text-sm transition-all ${
              activeTab === "security" 
                ? "bg-[#1E3A5F] dark:bg-sky-600 text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Shield className="mr-2 h-4 w-4 shrink-0" />
            <span>Sécurité & Accès</span>
            {unresolvedConflictsCount > 0 && (
              <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                {unresolvedConflictsCount}
              </span>
            )}
          </Button>

          <div className="pl-2 ml-1 border-l md:ml-0 md:pl-0 md:pt-4 md:border-l-0 md:border-t border-slate-200 dark:border-slate-800 md:mt-4 shrink-0">
            <Button 
              variant="ghost" 
              onClick={handleLogout} 
              className="whitespace-nowrap md:w-full justify-start text-red-600 dark:text-rose-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-rose-950/30 text-xs sm:text-sm font-semibold h-9 md:h-10"
            >
              <LogOut className="mr-2 h-4 w-4 shrink-0" />
              <span>Déconnexion</span>
            </Button>
          </div>
        </div>

        {/* Contenu Principal selon l'onglet actif */}
        <div className="md:col-span-3 min-w-0 space-y-6">
          {/* ================= ONGLET 1 : PROFIL & PRÉFÉRENCES ================= */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Informations Personnelles */}
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Informations Personnelles</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Vos coordonnées de compte enregistrées sur MonBudget.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nom complet</label>
                    <Input 
                      placeholder="Votre nom complet" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      className="dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Adresse e-mail</label>
                      <span className="text-xs text-slate-400">Identifiant de connexion</span>
                    </div>
                    <Input 
                      type="email" 
                      value={email} 
                      disabled
                      className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed dark:border-slate-700"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Préférences du Budget */}
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Préférences de Calcul & Affichage
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Paramétrez les règles de gestion de votre salaire.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Devise */}
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Devise par défaut</label>
                    <select 
                      value={localCurrency} 
                      onChange={(e) => setLocalCurrency(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2"
                    >
                      <option value="FCFA">FCFA (Franc CFA - XOF)</option>
                      <option value="EUR">EUR (€ - Euro)</option>
                      <option value="USD">USD ($ - Dollar US)</option>
                    </select>
                  </div>

                  {/* Jour de paie */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t dark:border-slate-800 pt-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
                        Jour de paie habituel
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                        Date à laquelle votre salaire est versé chaque mois (sert au calcul du budget journalier conseillé).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Le</span>
                      <select 
                        value={localPayDay} 
                        onChange={(e) => setLocalPayDay(Number(e.target.value))}
                        className="flex h-10 w-24 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                      <span className="text-sm text-slate-500 dark:text-slate-400">du mois</span>
                    </div>
                  </div>

                  {/* Seuil d'alerte */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t dark:border-slate-800 pt-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        Seuil d'alerte des enveloppes
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                        Déclenche un avertissement visuel lorsque vos dépenses atteignent ce pourcentage du budget.
                      </p>
                    </div>
                    <select 
                      value={localAlert} 
                      onChange={(e) => setLocalAlert(Number(e.target.value))}
                      className="flex h-10 w-28 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-semibold"
                    >
                      <option value={50}>50 %</option>
                      <option value={75}>75 %</option>
                      <option value={80}>80 % (conseillé)</option>
                      <option value={90}>90 %</option>
                      <option value={100}>100 %</option>
                    </select>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end pt-2 border-t dark:border-slate-800">
                  <Button 
                    onClick={handleSaveProfileAndPreferences} 
                    disabled={isSavingPrefs}
                    className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isSavingPrefs ? "Enregistrement..." : "Sauvegarder les modifications"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* ================= ONGLET : MON ABONNEMENT (MONERIZ) ================= */}
          {activeTab === "subscription" && (
            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <Crown className="h-5 w-5 text-amber-500" />
                        Formule d&apos;Abonnement Actuelle
                      </CardTitle>
                      <CardDescription className="text-slate-500 dark:text-slate-400">
                        Gérez votre plan MonBudget et vos paiements sécurisés via Moneriz.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const res = await refreshSubscription();
                        toast.success(
                          `Statut vérifié : Plan ${catalog[res.planId].name}`
                        );
                      }}
                      className="text-xs gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Actualiser mon statut</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div suppressHydrationWarning className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950">
                          {isAdminUser
                            ? "Super-Admin (Accès illimité)"
                            : !subscriptionHydrated
                            ? "Vérification en cours..."
                            : subscriptionCountdown.isTrialActive
                            ? "Essai Complet 30 Jours"
                            : subscriptionCountdown.needsPlanChoice
                            ? "Fin d'essai — Choix requis"
                            : `Plan ${catalog[subscriptionCountdown.effectivePlanId]?.name || "Gratuit"}`}
                        </span>
                        {!isAdminUser &&
                          subscriptionHydrated &&
                          subscriptionCountdown.isPaidActive &&
                          billingCycle !== "none" && (
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            • Cycle {billingCycle === "yearly" ? "Annuel (-2 mois offerts)" : "Mensuel"}
                          </span>
                        )}
                        {!isAdminUser &&
                          subscriptionHydrated &&
                          subscriptionCountdown.isTrialActive &&
                          subscriptionCountdown.trialDaysRemaining !== null && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                                subscriptionCountdown.isTrialExpiringSoon
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                  : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-700"
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              <span>
                                {subscriptionCountdown.trialDaysRemaining} jour
                                {subscriptionCountdown.trialDaysRemaining > 1 ? "s" : ""} d&apos;essai restant
                                {subscriptionCountdown.trialDaysRemaining > 1 ? "s" : ""}
                              </span>
                            </span>
                          )}
                        {!isAdminUser &&
                          subscriptionHydrated &&
                          subscriptionCountdown.isPaidActive &&
                          subscriptionCountdown.daysRemaining !== null && (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                              subscriptionCountdown.isExpiringSoon
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            <span>
                              {subscriptionCountdown.daysRemaining} jour{subscriptionCountdown.daysRemaining > 1 ? "s" : ""} restant{subscriptionCountdown.daysRemaining > 1 ? "s" : ""}
                            </span>
                          </span>
                        )}
                        {!isAdminUser && subscriptionHydrated && subscriptionCountdown.needsPlanChoice && (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Essai 30j terminé</span>
                          </span>
                        )}
                        {!isAdminUser && subscriptionHydrated && subscriptionCountdown.isExpired && (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Abonnement expiré</span>
                          </span>
                        )}
                      </div>
                      <p suppressHydrationWarning className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        {isAdminUser
                          ? "Votre compte Super-Administrateur bénéficie d'un accès complet permanent sans expiration."
                          : !subscriptionHydrated
                          ? "Synchronisation de votre statut d'abonnement et d'essai 30 jours avec le serveur..."
                          : subscriptionCountdown.isTrialActive
                          ? `Toutes les fonctionnalités sont débloquées gratuitement jusqu'au ${subscriptionCountdown.formattedTrialEndsAt || "terme de vos 30 jours"}. Ensuite, vous choisirez librement entre Gratuit limité (0 F), Particulier (${catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} F) ou Entreprise (${catalog.business.monthlyPriceXof.toLocaleString("fr-FR")} F).`
                          : subscriptionCountdown.needsPlanChoice
                          ? `Votre essai complet de 30 jours est arrivé à terme${subscriptionCountdown.formattedTrialEndsAt ? ` le ${subscriptionCountdown.formattedTrialEndsAt}` : ""}. Choisissez ci-dessous le mode Gratuit limité (Entrées/Dépenses), Particulier (${catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois) ou Entreprise (${catalog.business.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois).`
                          : subscriptionCountdown.isPaidActive
                          ? subscriptionCountdown.formattedExpiresAt
                            ? subscriptionCountdown.isExpiringSoon
                              ? `Valide jusqu'au ${subscriptionCountdown.formattedExpiresAt}. Renouvelez bientôt pour éviter toute interruption.`
                              : `Valide jusqu'au ${subscriptionCountdown.formattedExpiresAt} (renouvellement ou changement de formule possible à tout moment).`
                            : "Abonnement actif."
                          : subscriptionCountdown.isExpired
                          ? `Votre dernier abonnement est arrivé à échéance${subscriptionCountdown.formattedExpiresAt ? ` le ${subscriptionCountdown.formattedExpiresAt}` : ""}. Votre compte est repassé sur le Plan Gratuit ; toutes vos données restent conservées.`
                          : `Accès aux Entrées et Dépenses uniquement. Passez au plan Particulier (${catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois) pour tout débloquer, ou Entreprise (${catalog.business.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois).`}
                      </p>
                    </div>

                    {!isAdminUser &&
                      subscriptionHydrated &&
                      (subscriptionCountdown.isTrialActive || subscriptionCountdown.needsPlanChoice) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isChoosingFree}
                          onClick={async () => {
                            setIsChoosingFree(true);
                            try {
                              const ok = await chooseFreePlan();
                              if (ok) {
                                toast.info(
                                  `Mode Gratuit limité activé (Entrées & Dépenses). Les outils payants sont cadenassés et déblocables à ${catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois.`
                                );
                              }
                            } finally {
                              setIsChoosingFree(false);
                            }
                          }}
                          className="text-xs shrink-0 border-slate-300 dark:border-slate-600"
                        >
                          {isChoosingFree ? "Activation..." : "Continuer en mode Gratuit limité"}
                        </Button>
                      )}
                  </div>

                  <SubscriptionPlansWidget highlightPlan={highlightedPlan} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* ================= ONGLET : APPARENCE & THÈME ================= */}
          {activeTab === "appearance" && (
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Palette className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Apparence & Thème d&apos;Affichage
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Personnalisez l&apos;interface visuelle selon votre confort de lecture (clair, sombre ou automatique).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Option 1: Clair */}
                  <div
                    onClick={() => {
                      setTheme("light");
                      toast.success("Thème clair activé !");
                    }}
                    className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:scale-[1.02] flex flex-col justify-between gap-3 ${
                      mounted && theme === "light"
                        ? "border-[#1E3A5F] bg-blue-50/50 dark:bg-blue-950/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        <Sun className="h-5 w-5" />
                      </div>
                      {mounted && theme === "light" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1E3A5F] text-white">
                          <CheckCircle2 className="h-3 w-3" /> Actif
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">Mode Clair</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Interface claire et lumineuse, idéale pour les environnements ensoleillés.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Sombre */}
                  <div
                    onClick={() => {
                      setTheme("dark");
                      toast.success("Thème sombre activé !");
                    }}
                    className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:scale-[1.02] flex flex-col justify-between gap-3 ${
                      mounted && theme === "dark"
                        ? "border-[#1E3A5F] dark:border-blue-500 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-indigo-900 text-indigo-300">
                        <Moon className="h-5 w-5" />
                      </div>
                      {mounted && theme === "dark" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500 text-white">
                          <CheckCircle2 className="h-3 w-3" /> Actif
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">Mode Sombre</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Réduit la fatigue oculaire la nuit et préserve la batterie de votre smartphone.
                      </p>
                    </div>
                  </div>

                  {/* Option 3: Système */}
                  <div
                    onClick={() => {
                      setTheme("system");
                      toast.success("Thème calqué sur le système !");
                    }}
                    className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:scale-[1.02] flex flex-col justify-between gap-3 ${
                      mounted && theme === "system"
                        ? "border-[#1E3A5F] bg-blue-50/50 dark:bg-blue-950/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Monitor className="h-5 w-5" />
                      </div>
                      {mounted && theme === "system" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1E3A5F] text-white">
                          <CheckCircle2 className="h-3 w-3" /> Actif
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">Système</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        S&apos;adapte automatiquement au réglage sombre ou clair de votre appareil.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>Thème actuellement détecté : <strong className="text-slate-900 dark:text-white capitalize">{mounted ? (theme === "system" ? `Automatique (${systemTheme})` : theme) : "..."}</strong></span>
                  <span className="text-slate-400">Enregistré localement</span>
                </div>

                {/* Section Installation Application & Mode Hors-ligne */}
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Download className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
                      Application & Synchronisation Hors-Ligne (PWA)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Installez MonBudget sur votre machine (ordinateur ou smartphone) pour y accéder même sans connexion Internet.
                    </p>
                  </div>

                  <InstallButton variant="settings" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">État du réseau et de la synchronisation :</span>
                      <p className="text-slate-500 dark:text-slate-400">
                        {isOnline ? "🟢 Connecté à Internet - Vos données sont synchronisées avec le cloud Supabase." : "🟠 Hors-ligne - Vos données sont sauvegardées en local sur cet appareil."}
                      </p>
                    </div>
                    {pendingSyncCount > 0 ? (
                      <Button
                        size="sm"
                        onClick={() => void syncPendingQueue(true)}
                        disabled={!isOnline}
                        className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs shrink-0 gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Synchroniser ({pendingSyncCount})</span>
                      </Button>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Synchronisé
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ================= ONGLET 2 : NOTIFICATIONS ================= */}
          {activeTab === "notifications" && (
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Alertes & Notifications In-App
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Activez, personnalisez et enregistrez la manière dont MonBudget vous avertit en temps réel.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* 1. Alerte de seuil d'enveloppe */}
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 transition-all hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Alertes de seuil d'enveloppe</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${notifBudgetAlert ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>
                          {notifBudgetAlert ? "Activé" : "Désactivé"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Affiche un avertissement instantané dès qu'une dépense atteint ou dépasse le seuil défini.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notifBudgetAlert} 
                        onChange={(e) => setNotifBudgetAlert(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A5F] dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {notifBudgetAlert && (
                    <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Déclencher l'alerte à :</span>
                      <div className="flex items-center gap-2">
                        <select 
                          value={notifBudgetAlertThreshold} 
                          onChange={(e) => setNotifBudgetAlertThreshold(Number(e.target.value))}
                          className="flex h-9 w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                        >
                          <option value={50}>50 % du budget</option>
                          <option value={75}>75 % du budget</option>
                          <option value={80}>80 % (conseillé)</option>
                          <option value={90}>90 % du budget</option>
                          <option value={100}>100 % (épuisé)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Rappel avant le jour de paie */}
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 transition-all hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Rappels avant le jour de paie</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${notifPayDayReminder ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>
                          {notifPayDayReminder ? "Activé" : "Désactivé"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Bannière de vigilance sur le tableau de bord à l'approche de votre versement (le {localPayDay} du mois).
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notifPayDayReminder} 
                        onChange={(e) => setNotifPayDayReminder(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A5F] dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {notifPayDayReminder && (
                    <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Délai d'anticipation :</span>
                      <div className="flex items-center gap-2">
                        <select 
                          value={notifPayDayReminderDays} 
                          onChange={(e) => setNotifPayDayReminderDays(Number(e.target.value))}
                          className="flex h-9 w-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                        >
                          <option value={3}>3 jours avant</option>
                          <option value={5}>5 jours avant</option>
                          <option value={7}>7 jours avant (recommandé)</option>
                          <option value={10}>10 jours avant</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Bilan hebdomadaire */}
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 transition-all hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Bilan hebdomadaire</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${notifWeeklySummary ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>
                          {notifWeeklySummary ? "Activé" : "Désactivé"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Récapitulatif visuel du rythme des dépenses chaque dimanche soir pour préparer la semaine suivante.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notifWeeklySummary} 
                        onChange={(e) => setNotifWeeklySummary(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A5F] dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-3 border-t dark:border-slate-800">
                <Button 
                  onClick={handleSaveNotifications}
                  disabled={isSavingNotifs}
                  className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white gap-2 shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  {isSavingNotifs ? "Enregistrement..." : "Enregistrer les notifications"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* ================= ONGLET 3 : SÉCURITÉ & ACCÈS ================= */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Changement de mot de passe */}
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    Changer de Mot de Passe
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Mettez à jour le mot de passe de votre compte Supabase Auth.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleUpdatePassword}>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nouveau mot de passe</label>
                      <Input 
                        type="password" 
                        placeholder="Au moins 8 caractères" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirmer le nouveau mot de passe</label>
                      <Input 
                        type="password" 
                        placeholder="Retapez le mot de passe" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end pt-2 border-t dark:border-slate-800">
                    <Button 
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white gap-2"
                    >
                      <Shield className="h-4 w-4" />
                      {isUpdatingPassword ? "Mise à jour..." : "Modifier mon mot de passe"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>

              {/* État de la session */}
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Session & Appareil Actuel</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Informations sur votre session connectée.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Compte connecté :</span>
                    <strong className="text-slate-800 dark:text-slate-200 break-all">{email || "Utilisateur"}</strong>
                  </div>
                  {userId && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">ID Unique :</span>
                      <code className="text-slate-600 dark:text-slate-300 font-mono text-[11px] break-all">{userId}</code>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Sécurité par RLS active
                    </span>
                    <span>Données isolées et chiffrées</span>
                  </div>
                </CardContent>
              </Card>

              {/* Sauvegarde & Portabilité des Données (Export Intégral RGPD) */}
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Database className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                    Sauvegarde & Portabilité des Données
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Conformément aux normes de protection des données, vous pouvez télécharger une copie intégrale de l'ensemble de vos données financières à tout moment.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Cette archive consolidée contient l'ensemble de vos <strong>budgets mensuels</strong>, vos <strong>enveloppes</strong>, vos <strong>transactions et justificatifs</strong>, ainsi que vos <strong>cagnottes d'épargne et dettes</strong> au format standard ouvert JSON.
                  </p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300">
                        <FileJson className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Export Complet du Compte (JSON)
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Format universel réutilisable et archivable
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleExportAllData}
                      disabled={isExportingAll}
                      className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs h-9 gap-2 shadow-xs shrink-0"
                    >
                      <Download className={`h-4 w-4 ${isExportingAll ? "animate-bounce" : ""}`} />
                      {isExportingAll ? "Génération en cours..." : "Télécharger ma sauvegarde complète"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Révision Manuelle des Conflits Multi-Appareils */}
              <Card
                id="conflicts-review"
                className="scroll-mt-24 border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <ArrowLeftRight className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        Révision Manuelle des Conflits Multi-Appareils
                      </CardTitle>
                      <CardDescription className="text-slate-500 dark:text-slate-400">
                        Comparez la version de cet appareil avec celle du serveur lorsque deux appareils modifient ou suppriment la même donnée hors ligne.
                      </CardDescription>
                    </div>
                    {syncConflicts.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/70 dark:border-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {syncConflicts.length} à réviser
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Aucun conflit
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {syncConflicts.length === 0 ? (
                    <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        Aucun conflit concurrent en attente de révision. Vos appareils sont parfaitement alignés.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {syncConflicts.map((conflict) => {
                        const localDetails = formatConflictVersionLines(
                          conflict.entityType,
                          conflict.localData,
                          storeCurrency || localCurrency
                        );
                        const remoteDetails = formatConflictVersionLines(
                          conflict.entityType,
                          conflict.remoteData,
                          storeCurrency || localCurrency
                        );
                        const isBusy = resolvingConflictId === conflict.id;
                        const isDeleteVsEdit = conflict.conflictType === "delete_vs_edit";

                        return (
                          <div
                            key={conflict.id}
                            data-testid={`conflict-card-${conflict.id}`}
                            className="rounded-xl border border-amber-300/70 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                    {getEntityTypeLabel(conflict.entityType)}
                                  </span>
                                  <span
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                      isDeleteVsEdit
                                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    }`}
                                  >
                                    {isDeleteVsEdit
                                      ? "Suppression vs Édition"
                                      : "Modification concurrente"}
                                  </span>
                                  {conflict.monthKey && (
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                      Mois : {conflict.monthKey}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  {conflict.label}
                                </p>
                              </div>
                              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                {getAutoResolutionLabel(conflict.resolution)}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {/* Version locale */}
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                                    <Smartphone className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                                    Version locale (cet appareil)
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {formatConflictTimestamp(conflict.localUpdatedAt)}
                                  </span>
                                </div>
                                {localDetails.isDeleted ? (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold">
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Supprimé localement
                                  </div>
                                ) : (
                                  <dl className="space-y-1">
                                    {localDetails.lines.map((line) => (
                                      <div
                                        key={line.key}
                                        className="flex items-center justify-between gap-2"
                                      >
                                        <dt className="text-slate-500 dark:text-slate-400">
                                          {line.key}
                                        </dt>
                                        <dd className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                                          {line.value}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                )}
                              </div>

                              {/* Version serveur */}
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                                    <Cloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    Version serveur (autre appareil)
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {formatConflictTimestamp(conflict.remoteUpdatedAt)}
                                  </span>
                                </div>
                                {remoteDetails.isDeleted ? (
                                  <div className="space-y-1.5">
                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold">
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Supprimé sur un autre appareil
                                    </div>
                                    {remoteDetails.lines.length > 0 && (
                                      <dl className="space-y-1 opacity-75">
                                        {remoteDetails.lines.map((line) => (
                                          <div
                                            key={line.key}
                                            className="flex items-center justify-between gap-2"
                                          >
                                            <dt className="text-slate-500 dark:text-slate-400">
                                              {line.key}
                                            </dt>
                                            <dd className="font-medium text-slate-700 dark:text-slate-300 text-right line-through">
                                              {line.value}
                                            </dd>
                                          </div>
                                        ))}
                                      </dl>
                                    )}
                                  </div>
                                ) : (
                                  <dl className="space-y-1">
                                    {remoteDetails.lines.map((line) => (
                                      <div
                                        key={line.key}
                                        className="flex items-center justify-between gap-2"
                                      >
                                        <dt className="text-slate-500 dark:text-slate-400">
                                          {line.key}
                                        </dt>
                                        <dd className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                                          {line.value}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => handleResolveConflict(conflict.id, "keep_local")}
                                className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs gap-1.5"
                              >
                                <Smartphone className="h-3.5 w-3.5" />
                                Garder ma version locale
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => handleResolveConflict(conflict.id, "keep_remote")}
                                className="text-xs gap-1.5 border-slate-300 dark:border-slate-700"
                              >
                                <Cloud className="h-3.5 w-3.5" />
                                {remoteDetails.isDeleted
                                  ? "Confirmer la suppression serveur"
                                  : "Garder la version serveur"}
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={isBusy}
                                onClick={() => handleResolveConflict(conflict.id, "dismiss")}
                                className="text-xs gap-1.5 text-slate-600 dark:text-slate-300"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Valider tel quel et fermer
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Base Locale Offline-First & Restauration d'Urgence (SHA-256) */}
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <HardDrive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Base Locale Offline-First & Récupération
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Contrôlez votre base locale IndexedDB isolée, relancez une synchronisation ou restaurez une archive vérifiée par empreinte SHA-256.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 block">État réseau & synchro</span>
                      <strong className="text-slate-900 dark:text-slate-100 mt-0.5 block">
                        {!isOnline
                          ? "Hors-ligne (stockage local actif)"
                          : syncStatus === "syncing"
                          ? "Synchronisation en cours…"
                          : syncStatus === "auth_expired"
                          ? "Session expirée (en pause sûre)"
                          : syncStatus === "error"
                          ? "Erreur réseau (nouvel essai auto)"
                          : "En ligne & synchronisé"}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 block">File d'attente locale</span>
                      <strong className="text-slate-900 dark:text-slate-100 mt-0.5 block">
                        {pendingSyncCount} opération{pendingSyncCount > 1 ? "s" : ""} en attente
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 block">Dernière synchronisation</span>
                      <strong className="text-slate-900 dark:text-slate-100 mt-0.5 block">
                        {lastSyncedAt
                          ? new Date(lastSyncedAt).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "En attente"}
                      </strong>
                    </div>
                  </div>

                  {unresolvedConflictsCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("conflicts-review")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                      className="w-full text-left p-3 rounded-xl bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 transition-colors cursor-pointer"
                    >
                      {unresolvedConflictsCount} conflit(s) multi-appareils à réviser ci-dessus. Cliquez ici pour y accéder.
                    </button>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void syncPendingQueue(true)}
                      className="text-xs gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Synchroniser maintenant
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void exportOfflineBackup()}
                      className="text-xs gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exporter base locale (SHA-256)
                    </Button>

                    <input
                      ref={offlineBackupInputRef}
                      type="file"
                      accept="application/json,.json"
                      onChange={handleRestoreOfflineFile}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRestoringOffline}
                      onClick={() => offlineBackupInputRef.current?.click()}
                      className="text-xs gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {isRestoringOffline ? "Restauration..." : "Restaurer une sauvegarde (.json)"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
