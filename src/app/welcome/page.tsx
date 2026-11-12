"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useUIStore } from "@/lib/store/ui-store";
import { getPlanCatalog, getSubscriptionCountdownInfo } from "@/lib/moneriz-plans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
  LogOut,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

function sanitizeInternalNext(rawNext: string | null): string {
  if (
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.includes("\\") &&
    !rawNext.includes("://") &&
    !rawNext.startsWith("/welcome")
  ) {
    return rawNext;
  }
  return "/dashboard";
}

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const {
    subscriptionPlan,
    subscriptionStatus,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdminUser,
    refreshSubscription,
    updatePreferences,
    resetStore,
  } = useUIStore();

  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [fullName, setFullName] = useState("");
  const [currency, setCurrency] = useState("FCFA");
  const [payDay, setPayDay] = useState(28);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const nextTarget = sanitizeInternalNext(searchParams.get("next"));
  const isSubscriptionFlow = nextTarget.includes("tab=subscription");

  useEffect(() => {
    let mounted = true;
    const loadUserContext = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          if (mounted) router.replace("/login");
          return;
        }

        const userEmail = user.email || "";
        const metaName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          userEmail.split("@")[0] ||
          "Membre";
        const metaAvatar =
          user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

        const [{ data: profile }, subStatus] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, currency, pay_day")
            .eq("id", user.id)
            .maybeSingle(),
          refreshSubscription().catch(() => null),
        ]);

        if (mounted) {
          setEmail(userEmail);
          setIsSuperAdmin(Boolean(subStatus?.isAdmin));
          setAvatarUrl(metaAvatar);
          setFullName(profile?.full_name || metaName);
          setCurrency(profile?.currency && profile.currency.trim() ? profile.currency.trim() : "FCFA");
          setPayDay(profile?.pay_day ? Number(profile.pay_day) : 28);
          setLoadingUser(false);
        }
      } catch {
        if (mounted) router.replace("/login");
      }
    };

    loadUserContext();
    return () => {
      mounted = false;
    };
  }, [router, supabase, refreshSubscription]);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanName = fullName.trim() || email.split("@")[0] || "Membre";
      const safePayDay = Math.min(31, Math.max(1, Number(payDay) || 28));

      await updatePreferences({
        fullName: cleanName,
        currency: currency || "FCFA",
        payDay: safePayDay,
      });

      toast.success(`Bienvenue ${cleanName} ! Votre espace est prêt.`);
      window.location.href = nextTarget;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Impossible d'enregistrer vos préférences.";
      toast.error(msg);
      setSaving(false);
    }
  };

  const handleSwitchAccount = async () => {
    setSwitchingAccount(true);
    try {
      resetStore();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Erreur lors du changement de compte.");
      setSwitchingAccount(false);
    }
  };

  const effectiveIsAdmin = isSuperAdmin || isAdminUser;
  const catalog = getPlanCatalog();
  const countdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: effectiveIsAdmin,
  });
  const planLabel = effectiveIsAdmin
    ? "Super-Admin"
    : countdown.isTrialActive
    ? "Essai 30j Complet (Toutes fonctionnalités)"
    : `Plan ${catalog[countdown.effectivePlanId]?.name || "Gratuit"}`;

  return (
    <div className="min-h-screen relative bg-slate-50 dark:bg-[#071324] flex flex-col items-center justify-center p-3 sm:p-4 py-16 transition-colors">
      {/* Bouton Retour vers la Landing Page en haut à gauche */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <Link
          href="/"
          aria-label="Retour à l'accueil"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Retour à l&apos;accueil</span>
        </Link>
      </div>

      <Card className="w-full max-w-lg border-none shadow-2xl overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#1E3A5F] via-sky-500 to-emerald-500" />

        <CardHeader className="space-y-4 items-center text-center pt-6 pb-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md p-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <Image
                src="/logo.png"
                alt="MonBudget Logo"
                width={40}
                height={40}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-[#1E3A5F] dark:text-white">
              Mon<span className="text-emerald-500">Budget</span>
            </span>
          </Link>

          {/* Avatar Google / Initiale + Badge vérifié */}
          <div className="relative">
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt={fullName || "Profil"}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1E3A5F] to-emerald-500 flex items-center justify-center text-white text-2xl font-extrabold border-4 border-white dark:border-slate-800 shadow-lg">
                {fullName ? fullName.charAt(0).toUpperCase() : <UserIcon className="w-8 h-8" />}
              </div>
            )}
            <span
              title="Compte authentifié"
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>

          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
              {loadingUser ? "Préparation de votre espace..." : `Bienvenue sur MonBudget !`}
            </CardTitle>
            <CardDescription className="text-sm">
              Vérifiez votre compte connecté ci-dessous puis cliquez sur Continuer.
            </CardDescription>
          </div>

          {/* Email & Badge Plan */}
          {!loadingUser && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                {email}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                  effectiveIsAdmin
                    ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    : "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                }`}
              >
                <Crown className="w-3 h-3" />
                {planLabel}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loadingUser ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-500 text-sm">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <span>Synchronisation de votre profil Google...</span>
            </div>
          ) : (
            <form onSubmit={handleContinue} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="welcome-fullname">Votre nom ou pseudo</Label>
                <Input
                  id="welcome-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Fidèle Atchadé"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="welcome-currency">Devise principale</Label>
                  <select
                    id="welcome-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <option value="FCFA">FCFA (Franc CFA)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="USD">USD ($ - Dollar US)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="welcome-payday">Jour de paie habituel</Label>
                  <Input
                    id="welcome-payday"
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={payDay}
                    onChange={(e) => setPayDay(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  {countdown.isTrialActive && !effectiveIsAdmin
                    ? `Votre essai complet de 30 jours est actif (${countdown.trialDaysRemaining ?? 30} jours restants avec toutes les fonctionnalités débloquées). À l'issue des 30 jours, vous choisirez librement entre Gratuit limité (Entrées/Dépenses), Particulier (500 F) ou Entreprise.`
                    : "Ces réglages permettent d'adapter automatiquement vos graphiques, enveloppes et calculs journaliers. Modifiable à tout moment dans Paramètres."}
                </span>
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>
                  {saving
                    ? "Ouverture en cours..."
                    : isSubscriptionFlow
                    ? "Continuer vers mon abonnement"
                    : "Continuer vers mon tableau de bord"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={handleSwitchAccount}
            disabled={switchingAccount || saving}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>
              {switchingAccount
                ? "Déconnexion..."
                : "Ce n'est pas votre compte ? Changer d'adresse"}
            </span>
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#071324] text-slate-500">
          Chargement de votre espace MonBudget...
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}

