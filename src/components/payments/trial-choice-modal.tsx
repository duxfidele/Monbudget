"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
  MONERIZ_PAYMENT_GATEWAYS,
  MonerizPaymentGateway,
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
  const [selectedGatewayId, setSelectedGatewayId] =
    useState<MonerizPaymentGateway["id"]>("wave");
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
  const selectedGateway =
    MONERIZ_PAYMENT_GATEWAYS.find((g) => g.id === selectedGatewayId) ??
    MONERIZ_PAYMENT_GATEWAYS[0];

  const personalPrice =
    selectedCycle === "yearly"
      ? catalog.personal.yearlyPriceXof
      : catalog.personal.monthlyPriceXof;
  const businessPrice =
    selectedCycle === "yearly"
      ? catalog.business.yearlyPriceXof
      : catalog.business.monthlyPriceXof;

  const handleChooseFree = async () => {
    setIsChoosingFree(true);
    try {
      const ok = await chooseFreePlan();
      if (ok) {
        toast.info(
          `Mode Gratuit activé : Page Budget (salaire & enveloppes) + Entrées & Dépenses illimitées. Les outils avancés sont déblocables dès ${catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois.`
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
                {countdown.formattedTrialEndsAt ? ` (le ${countdown.formattedTrialEndsAt})` : ""}. Continuez gratuitement avec votre page Budget, vos Entrées &amp; Dépenses, ou débloquez tout avec{" "}
                <strong>
                  Particulier ({catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois)
                </strong>{" "}
                ou{" "}
                <strong>
                  Entreprise ({catalog.business.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois)
                </strong>
                .
              </DialogDescription>
            </DialogHeader>

            {/* Contrôles dynamiques : Périodicité + Passerelle Moneriz */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1 px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
              <div className="inline-flex max-w-full flex-wrap justify-center items-center p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-center sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSelectedCycle("monthly")}
                  className={`cursor-pointer px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98] ${
                    selectedCycle === "monthly"
                      ? "bg-[#1E3A5F] text-white shadow-xs dark:bg-sky-500 dark:text-slate-950"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Mensuel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCycle("yearly")}
                  className={`cursor-pointer px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-[0.98] ${
                    selectedCycle === "yearly"
                      ? "bg-[#1E3A5F] text-white shadow-xs dark:bg-sky-500 dark:text-slate-950"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Annuel</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-emerald-500 text-white whitespace-nowrap">
                    -2 mois offerts
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1">
                {MONERIZ_PAYMENT_GATEWAYS.map((gw) => {
                  const isSelected = selectedGatewayId === gw.id;
                  return (
                    <button
                      key={gw.id}
                      type="button"
                      onClick={() => setSelectedGatewayId(gw.id)}
                      className={`cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all active:scale-95 ${
                        isSelected
                          ? `${gw.badgeClasses} ring-1 ring-sky-400`
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
                      <span>{gw.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* 1. Gratuit */}
              <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-col justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {catalog.free.name}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Essentiel
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    0 FCFA
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Page Budget (salaire, revenus &amp; enveloppes) + Entrées &amp; Dépenses</span>
                    </li>
                    <li className="flex items-start gap-1.5 opacity-70">
                      <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>Pilotage quotidien, Épargne, Dettes, Rapports, Reçus &amp; IA cadenassés</span>
                    </li>
                  </ul>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={isChoosingFree}
                  onClick={handleChooseFree}
                  className="cursor-pointer w-full rounded-xl text-xs font-bold min-h-[42px] h-auto py-2 px-3 gap-1.5 transition-all active:scale-[0.98] flex items-center justify-center"
                >
                  {isChoosingFree ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <>
                      <span className="truncate">Continuer en Gratuit</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </>
                  )}
                </Button>
              </div>

              {/* 2. Particulier */}
              <div className="rounded-2xl p-4 bg-gradient-to-b from-[#1E3A5F] to-[#0F233F] text-white border-2 border-sky-400 shadow-lg flex flex-col justify-between gap-4 relative hover:-translate-y-0.5 transition-all">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Tout débloqué
                </span>
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm">{catalog.personal.name}</h4>
                    {selectedCycle === "yearly" && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                        -2 mois
                      </span>
                    )}
                  </div>
                  <div>
                    {selectedCycle === "yearly" && (
                      <p className="text-[11px] text-slate-300 line-through">
                        {(catalog.personal.monthlyPriceXof * 12).toLocaleString("fr-FR")} FCFA
                      </p>
                    )}
                    <p className="text-2xl font-extrabold">
                      {personalPrice.toLocaleString("fr-FR")} FCFA
                      <span className="text-xs font-normal text-slate-300">
                        {" "}
                        / {selectedCycle === "yearly" ? "an" : "mois"}
                      </span>
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-200">
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        100 % des fonctionnalités (Pilotage quotidien, Budget, Épargne, Dettes, Rapports, Reçus &amp; IA)
                      </span>
                    </li>
                  </ul>
                </div>

                <Button
                  type="button"
                  onClick={() => setCheckoutTarget("personal")}
                  className="cursor-pointer w-full rounded-xl text-xs font-bold min-h-[42px] h-auto py-2 px-3 bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 text-slate-950 gap-1.5 shadow-md transition-all active:scale-[0.98] flex items-center justify-center"
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Particulier • {personalPrice.toLocaleString("fr-FR")} F/
                    {selectedCycle === "yearly" ? "an" : "mois"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </Button>
              </div>

              {/* 3. Entreprise & Pro */}
              <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-4 hover:border-sky-300 dark:hover:border-sky-700 hover:-translate-y-0.5 transition-all">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-500" />
                      <span>{catalog.business.name}</span>
                    </h4>
                    {selectedCycle === "yearly" && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        -2 mois
                      </span>
                    )}
                  </div>
                  <div>
                    {selectedCycle === "yearly" && (
                      <p className="text-[11px] text-slate-400 line-through">
                        {(catalog.business.monthlyPriceXof * 12).toLocaleString("fr-FR")} FCFA
                      </p>
                    )}
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                      {businessPrice.toLocaleString("fr-FR")} FCFA
                      <span className="text-xs font-normal text-slate-500">
                        {" "}
                        / {selectedCycle === "yearly" ? "an" : "mois"}
                      </span>
                    </p>
                  </div>
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
                  className="cursor-pointer w-full rounded-xl text-xs font-bold min-h-[42px] h-auto py-2 px-3 bg-[#1E3A5F] hover:bg-[#162C49] text-white dark:bg-sky-600 dark:hover:bg-sky-500 gap-1.5 transition-all active:scale-[0.98] flex items-center justify-center"
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Entreprise • {businessPrice.toLocaleString("fr-FR")} F/
                    {selectedCycle === "yearly" ? "an" : "mois"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
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
                className="cursor-pointer rounded-xl text-xs gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Changer de formule</span>
              </Button>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Paiement intégré Moneriz • {selectedGateway.label}</span>
              </span>
            </div>
            <MonerizLiveframe
              planId={checkoutTarget}
              billingCycle={selectedCycle}
              preferredGatewayLabel={selectedGateway.label}
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
