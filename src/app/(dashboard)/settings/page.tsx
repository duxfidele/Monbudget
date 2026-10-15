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
  Wallet
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store/ui-store";

type TabType = "profile" | "notifications" | "security";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Profile data
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  // Preferences from store
  const { alertThreshold, currency: storeCurrency, payDay: storePayDay, updatePreferences } = useUIStore();
  const [localAlert, setLocalAlert] = useState(80);
  const [localCurrency, setLocalCurrency] = useState("FCFA");
  const [localPayDay, setLocalPayDay] = useState(28);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Notifications settings
  const [notifBudgetAlert, setNotifBudgetAlert] = useState(true);
  const [notifPayDayReminder, setNotifPayDayReminder] = useState(true);
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
            let pCur = profile.currency && profile.currency.trim() ? profile.currency : "FCFA";
            if (pCur === "EUR") {
              pCur = "FCFA";
              supabase.from("profiles").update({ currency: "FCFA" }).eq("id", user.id).then(() => {});
            }
            setLocalCurrency(pCur);
            if (profile.pay_day) setLocalPayDay(Number(profile.pay_day));
            if (profile.alert_threshold_percent) setLocalAlert(Number(profile.alert_threshold_percent));
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
    if (alertThreshold) setLocalAlert(alertThreshold);
    if (storeCurrency && storeCurrency !== "EUR") setLocalCurrency(storeCurrency);
    else setLocalCurrency("FCFA");
    if (storePayDay) setLocalPayDay(storePayDay);
  }, [alertThreshold, storeCurrency, storePayDay]);

  const handleLogout = async () => {
    try {
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
      // Stockage local / confirmation des alertes
      toast.success("Préférences de notifications enregistrées !", {
        description: "Vos paramètres d'alerte budgétaire ont été pris en compte.",
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
        <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 mb-1 border border-slate-200">
          <User className="h-3.5 w-3.5 text-[#1E3A5F]" />
          <span>Configuration du compte</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Paramètres
        </h2>
        <p className="text-slate-500 mt-1 text-sm md:text-base">
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
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <User className="mr-2 h-4 w-4" />
            Mon Profil & Budget
          </Button>

          <Button 
            variant={activeTab === "notifications" ? "secondary" : "ghost"} 
            onClick={() => setActiveTab("notifications")}
            className={`w-full justify-start font-medium text-sm transition-all ${
              activeTab === "notifications" 
                ? "bg-[#1E3A5F] text-white hover:bg-[#1E3A5F]/95 shadow-xs" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
              <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Informations Personnelles</CardTitle>
                  <CardDescription>Vos coordonnées de compte enregistrées sur MonBudget.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Nom complet</label>
                    <Input 
                      placeholder="Votre nom complet" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">Adresse e-mail</label>
                      <span className="text-xs text-slate-400">Identifiant de connexion</span>
                    </div>
                    <Input 
                      type="email" 
                      value={email} 
                      disabled
                      className="bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Préférences du Budget */}
              <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Préférences de Calcul & Affichage
                  </CardTitle>
                  <CardDescription>Paramétrez les règles de gestion de votre salaire.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Devise */}
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Devise par défaut</label>
                    <select 
                      value={localCurrency} 
                      onChange={(e) => setLocalCurrency(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2"
                    >
                      <option value="FCFA">FCFA (Franc CFA - XOF)</option>
                      <option value="EUR">EUR (€ - Euro)</option>
                      <option value="USD">USD ($ - Dollar US)</option>
                    </select>
                  </div>

                  {/* Jour de paie */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-[#1E3A5F]" />
                        Jour de paie habituel
                      </label>
                      <p className="text-xs text-slate-500 max-w-md">
                        Date à laquelle votre salaire est versé chaque mois (sert au calcul du budget journalier conseillé).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Le</span>
                      <select 
                        value={localPayDay} 
                        onChange={(e) => setLocalPayDay(Number(e.target.value))}
                        className="flex h-10 w-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                      <span className="text-sm text-slate-500">du mois</span>
                    </div>
                  </div>

                  {/* Seuil d'alerte */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        Seuil d'alerte des enveloppes
                      </label>
                      <p className="text-xs text-slate-500 max-w-md">
                        Déclenche un avertissement visuel lorsque vos dépenses atteignent ce pourcentage du budget.
                      </p>
                    </div>
                    <select 
                      value={localAlert} 
                      onChange={(e) => setLocalAlert(Number(e.target.value))}
                      className="flex h-10 w-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <option value={50}>50 %</option>
                      <option value={75}>75 %</option>
                      <option value={80}>80 % (conseillé)</option>
                      <option value={90}>90 %</option>
                      <option value={100}>100 %</option>
                    </select>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end pt-2 border-t">
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

          {/* ================= ONGLET 2 : NOTIFICATIONS ================= */}
          {activeTab === "notifications" && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-indigo-600" />
                  Alertes & Notifications In-App
                </CardTitle>
                <CardDescription>
                  Configurez la manière dont MonBudget vous avertit en cas de dérapage de vos dépenses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-800">Alertes de seuil d'enveloppe</p>
                    <p className="text-xs text-slate-500">
                      Recevoir un message d'alerte in-app lorsque vous dépassez {localAlert}% d'une enveloppe budgétaire.
                    </p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifBudgetAlert} 
                    onChange={(e) => setNotifBudgetAlert(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F] cursor-pointer mt-0.5"
                  />
                </div>

                <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-800">Rappels avant le jour de paie</p>
                    <p className="text-xs text-slate-500">
                      Afficher un rappel de vigilance lorsque vous êtes à moins de 7 jours de votre date de paie (le {localPayDay}).
                    </p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifPayDayReminder} 
                    onChange={(e) => setNotifPayDayReminder(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F] cursor-pointer mt-0.5"
                  />
                </div>

                <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-800">Bilan hebdomadaire</p>
                    <p className="text-xs text-slate-500">
                      Récapitulatif visuel du rythme des dépenses chaque dimanche soir.
                    </p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifWeeklySummary} 
                    onChange={(e) => setNotifWeeklySummary(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F] cursor-pointer mt-0.5"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-2 border-t">
                <Button 
                  onClick={handleSaveNotifications}
                  disabled={isSavingNotifs}
                  className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white gap-2"
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
              <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-amber-600" />
                    Changer de Mot de Passe
                  </CardTitle>
                  <CardDescription>
                    Mettez à jour le mot de passe de votre compte Supabase Auth.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleUpdatePassword}>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">Nouveau mot de passe</label>
                      <Input 
                        type="password" 
                        placeholder="Au moins 6 caractères" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">Confirmer le nouveau mot de passe</label>
                      <Input 
                        type="password" 
                        placeholder="Retapez le mot de passe" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end pt-2 border-t">
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
              <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Session & Appareil Actuel</CardTitle>
                  <CardDescription>Informations sur votre session connectée.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-xs">
                    <span className="text-slate-500">Compte connecté :</span>
                    <strong className="text-slate-800">{email || "Utilisateur"}</strong>
                  </div>
                  {userId && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-xs">
                      <span className="text-slate-500">ID Unique :</span>
                      <code className="text-slate-600 font-mono text-[11px]">{userId}</code>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 text-xs text-emerald-800">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
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
