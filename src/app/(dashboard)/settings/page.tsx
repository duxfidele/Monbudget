"use client";

import { useState, useEffect } from "react";
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
  Palette
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store/ui-store";

type TabType = "profile" | "appearance" | "notifications" | "security";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
    updatePreferences, 
    updateNotifications,
    resetStore
  } = useUIStore();

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
    if (!newPassword || newPassword.length < 6) {
      toast.error("Le mot de passe doit comporter au moins 6 caractères.");
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
        {/* Navigation des Onglets (Sidebar interne) */}
        <div className="md:col-span-1 space-y-1.5">
          <Button 
            variant={activeTab === "profile" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("profile")}
            className={`w-full justify-start font-medium text-sm transition-all ${
              activeTab === "profile" 
                ? "bg-[#1E3A5F] text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <User className="mr-2 h-4 w-4" />
            Mon Profil & Budget
          </Button>

          <Button 
            variant={activeTab === "appearance" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("appearance")}
            className={`w-full justify-start font-medium text-sm transition-all ${
              activeTab === "appearance" 
                ? "bg-[#1E3A5F] text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Palette className="mr-2 h-4 w-4" />
            Apparence & Thème
          </Button>

          <Button 
            variant={activeTab === "notifications" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("notifications")}
            className={`w-full justify-start font-medium text-sm transition-all ${
              activeTab === "notifications" 
                ? "bg-[#1E3A5F] text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </Button>

          <Button 
            variant={activeTab === "security" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("security")}
            className={`w-full justify-start font-medium text-sm transition-all ${
              activeTab === "security" 
                ? "bg-[#1E3A5F] text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Shield className="mr-2 h-4 w-4" />
            Sécurité & Accès
          </Button>

          <div className="pt-4 border-t mt-4">
            <Button 
              variant="ghost" 
              onClick={handleLogout} 
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 text-sm font-medium"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>

        {/* Contenu Principal selon l'onglet actif */}
        <div className="md:col-span-3 space-y-6">
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
                        placeholder="Au moins 6 caractères" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
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
                        minLength={6}
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
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Compte connecté :</span>
                    <strong className="text-slate-800 dark:text-slate-200">{email || "Utilisateur"}</strong>
                  </div>
                  {userId && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">ID Unique :</span>
                      <code className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">{userId}</code>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Sécurité par RLS active
                    </span>
                    <span>Données isolées et chiffrées</span>
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
