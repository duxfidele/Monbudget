"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Check, Crown, Lock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BillingCycle,
  getPlanCatalog,
  getSubscriptionCountdownInfo,
  PaidSubscriptionPlanId,
} from "@/lib/moneriz-plans";
import { useUIStore } from "@/lib/store/ui-store";
import { MonerizLiveframe } from "@/components/payments/moneriz-liveframe";
import { toast } from "sonner";

export function TrialChoiceModal() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    subscriptionHydrated,
    subscriptionPlan,
    subscriptionStatus,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdminUser,
    chooseFreePlan,
  } = useUIStore();

  const [dismissedForView, setDismissedForView] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");
  const [checkoutTarget, setCheckoutTarget] = useState<PaidSubscriptionPlanId | null>(null);
  const [isChoosingFree, setIsChoosingFree] = useState(false);

  const countdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: isAdminUser,
  });

  // Ne pas gêner l'utilisateur sur Paramètres, Aide ou Admin
  const isExemptRoute =
    pathname?.startsWith("/settings") ||
    pathname?.startsWith("/support") ||
    pathname?.startsWith("/admin");

  const shouldShow =
    subscriptionHydrated &&
    !isAdminUser &&
    countdown.needsPlanChoice &&
    !dismissedForView &&
    !isExemptRoute;

  if (!shouldShow) {
    return null;
  }

  const catalog = getPlanCatalog();

  const handleChooseFree = async () => {
    setIsChoosingFree(true);
    try {
      const ok = await chooseFreePlan();
      if (ok) {
        toast.info(
          `Mode Gratuit activé : vos Entrées & Dépenses restent illimitées. Les outils avancés sont cadenassés et déblocables à tout moment dès ${catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois.`
        );
      }
    } finally {
      setIsChoosingFree(false);
    }
  };

  return (
    <Dialog
      open={shouldShow}
      onOpenChange={(open) => {
        if (!open) {
          setCheckoutTarget(null);
          setDismissedForView(true);
        }
      }}
    >
      <DialogContent
        data-testid="trial-choice-modal"
        className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6"
      >
        {!checkoutTarget ? (
          <>
            <DialogHeader className="space-y-2 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold uppercase tracking-wider w-fit">
                <Lock className="w-3.5 h-3.5" />
                <span>Fin de votre essai gratuit de 30 jours</span>
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Choisissez votre formule pour continuer sur MonBudget
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Votre essai complet de 30 jours est terminé
                {countdown.formattedTrialEndsAt ? ` (le ${countdown.formattedTrialEndsAt})` : ""}. Choisissez de continuer gratuitement avec les Entrées &amp; Dépenses (outils avancés cadenassés), ou débloquez tout avec{" "}
                <strong>
                  Particulier ({catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois)
                </strong>{" "}
                ou{" "}
                <strong>Entreprise ({catalog.business.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois)</strong>.
              </DialogDescription>
            </DialogHeader>

            {/* Bascule Mensuel / Annuel */}
            <div className="flex justify-center pt-2">
              <div className="inline-flex max-w-full flex-wrap justify-center items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedCycle("monthly")}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedCycle === "monthly"
                      ? "bg-[#1E3A5F] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Mensuel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCycle("yearly")}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedCycle === "yearly"
                      ? "bg-[#1E3A5F] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <span>Annuel</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-emerald-500 text-white whitespace-nowrap">
                    2 mois offerts
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* 1. Gratuit limité */}
              <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {catalog.free.name}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Limité
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    0 FCFA
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Entrées &amp; Dépenses illimitées</span>
                    </li>
                    <li className="flex items-start gap-1.5 opacity-70">
                      <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>Budget, Épargne, Dettes, Rapports, Reçus &amp; IA cadenassés</span>
                    </li>
                  </ul>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={isChoosingFree}
                  onClick={handleChooseFree}
                  className="w-full rounded-xl text-xs font-bold h-10"
                >
                  {isChoosingFree ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Continuer en Gratuit"
                  )}
                </Button>
              </div>

              {/* 2. Particulier */}
              <div className="rounded-2xl p-4 bg-gradient-to-b from-[#1E3A5F] to-[#0F233F] text-white border-2 border-sky-400 shadow-lg flex flex-col justify-between gap-4 relative">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Tout débloqué
                </span>
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm">{catalog.personal.name}</h4>
                  </div>
                  <p className="text-2xl font-extrabold">
                    {(selectedCycle === "yearly"
                      ? catalog.personal.yearlyPriceXof
                      : catalog.personal.monthlyPriceXof
                    ).toLocaleString("fr-FR")}{" "}
                    FCFA
                    <span className="text-xs font-normal text-slate-300">
                      {" "}
                      / {selectedCycle === "yearly" ? "an" : "mois"}
                    </span>
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-slate-200">
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>100 % des fonctionnalités actuelles (Budget, Épargne, Dettes, Rapports, Reçus &amp; IA)</span>
                    </li>
                  </ul>
                </div>

                <Button
                  type="button"
                  onClick={() => setCheckoutTarget("personal")}
                  className="w-full rounded-xl text-xs font-bold h-10 bg-sky-400 hover:bg-sky-300 text-slate-950"
                >
                  Activer Particulier (
                  {(selectedCycle === "yearly"
                    ? catalog.personal.yearlyPriceXof
                    : catalog.personal.monthlyPriceXof
                  ).toLocaleString("fr-FR")}{" "}
                  FCFA)
                </Button>
              </div>

              {/* 3. Entreprise & Pro */}
              <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-500" />
                      <span>{catalog.business.name}</span>
                    </h4>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {(selectedCycle === "yearly"
                      ? catalog.business.yearlyPriceXof
                      : catalog.business.monthlyPriceXof
                    ).toLocaleString("fr-FR")}{" "}
                    FCFA
                    <span className="text-xs font-normal text-slate-500">
                      {" "}
                      / {selectedCycle === "yearly" ? "an" : "mois"}
                    </span>
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Tout du plan Particulier</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Support prioritaire 7j/7 &amp; futurs modules Entreprise</span>
                    </li>
                  </ul>
                </div>

                <Button
                  type="button"
                  onClick={() => setCheckoutTarget("business")}
                  className="w-full rounded-xl text-xs font-bold h-10 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white"
                >
                  Activer Entreprise
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCheckoutTarget(null)}
                className="rounded-xl text-xs gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Changer de formule</span>
              </Button>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Paiement intégré Moneriz
              </span>
            </div>
            <MonerizLiveframe
              planId={checkoutTarget}
              billingCycle={selectedCycle}
              onSuccess={() => {
                setCheckoutTarget(null);
                setDismissedForView(true);
                router.push("/dashboard");
                router.refresh();
              }}
              onCancel={() => setCheckoutTarget(null)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
