"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
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
  SubscriptionPlanId,
} from "@/lib/moneriz-plans";
import { useUIStore } from "@/lib/store/ui-store";
import { MonerizLiveframe } from "@/components/payments/moneriz-liveframe";
import { toast } from "sonner";

interface SubscriptionPlansWidgetProps {
  highlightPlan?: PaidSubscriptionPlanId;
  compact?: boolean;
}

export function SubscriptionPlansWidget({
  highlightPlan,
  compact = false,
}: SubscriptionPlansWidgetProps) {
  const router = useRouter();
  const {
    subscriptionPlan,
    subscriptionStatus,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdminUser,
    billingCycle: activeCycle,
    chooseFreePlan,
  } = useUIStore();
  const countdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: isAdminUser,
  });
  const effectivePlanId = countdown.effectivePlanId;
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(
    activeCycle === "yearly" ? "yearly" : "monthly"
  );
  const [focusedPlan, setFocusedPlan] = useState<SubscriptionPlanId>(
    highlightPlan ?? (effectivePlanId === "free" ? "personal" : effectivePlanId)
  );
  const [selectedGatewayId, setSelectedGatewayId] =
    useState<MonerizPaymentGateway["id"]>("wave");
  const [checkoutTarget, setCheckoutTarget] = useState<PaidSubscriptionPlanId | null>(null);
  const [isChoosingFree, setIsChoosingFree] = useState(false);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const catalog = getPlanCatalog();
  const plansList = [catalog.free, catalog.personal, catalog.business];
  const selectedGateway =
    MONERIZ_PAYMENT_GATEWAYS.find((g) => g.id === selectedGatewayId) ??
    MONERIZ_PAYMENT_GATEWAYS[0];

  const handleChooseFree = async () => {
    setIsChoosingFree(true);
    try {
      const ok = await chooseFreePlan();
      if (ok) {
        toast.info(
          `Mode Gratuit activé : Page Budget (salaire & enveloppes) + Entrées & Dépenses illimitées. Les modules avancés sont déblocables dès ${catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois.`
        );
      }
    } finally {
      setIsChoosingFree(false);
    }
  };

  const openCheckout = (planId: PaidSubscriptionPlanId) => {
    setFocusedPlan(planId);
    setCheckoutTarget(planId);
  };

  return (
    <div className="space-y-6">
      {/* Barre de contrôles dynamiques : Périodicité + Passerelle Moneriz */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Sélecteur Mensuel / Annuel */}
          <div className="flex flex-col items-center md:items-start gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1. Choisissez votre rythme de facturation
            </span>
            <div
              role="group"
              aria-label="Périodicité de facturation"
              className="inline-flex max-w-full flex-wrap justify-center items-center p-1 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs"
            >
              <button
                type="button"
                onClick={() => setSelectedCycle("monthly")}
                className={`cursor-pointer px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-[0.98] ${
                  selectedCycle === "monthly"
                    ? "bg-[#1E3A5F] text-white shadow-sm dark:bg-sky-500 dark:text-slate-950"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => setSelectedCycle("yearly")}
                className={`cursor-pointer px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 active:scale-[0.98] ${
                  selectedCycle === "yearly"
                    ? "bg-[#1E3A5F] text-white shadow-sm dark:bg-sky-500 dark:text-slate-950"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>Annuel</span>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-500 text-white whitespace-nowrap shadow-xs">
                  -2 mois offerts
                </span>
              </button>
            </div>
          </div>

          {/* Sélecteur interactif de passerelle Moneriz */}
          <div className="flex flex-col items-center md:items-end gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-500" />
              2. Moyen de paiement préféré (Moneriz)
            </span>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-1.5">
              {MONERIZ_PAYMENT_GATEWAYS.map((gw) => {
                const isSelected = selectedGatewayId === gw.id;
                return (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => setSelectedGatewayId(gw.id)}
                    aria-pressed={isSelected}
                    className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all active:scale-95 ${
                      isSelected
                        ? `${gw.badgeClasses} ring-2 ring-sky-400/50 shadow-xs`
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                    <span>{gw.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 text-center md:text-left">
          {selectedCycle === "yearly" ? (
            <>
              🎉 Facturation annuelle active : payez{" "}
              <strong>10 mois au lieu de 12</strong> et économisez jusqu&apos;à{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {catalog.business.yearlySavingsXof.toLocaleString("fr-FR")} FCFA/an
              </strong>
              .
            </>
          ) : (
            <>
              Astuce : basculez sur <strong>Annuel</strong> pour profiter automatiquement de{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">
                2 mois offerts
              </strong>{" "}
              et réduire votre coût mensuel.
            </>
          )}
        </p>
      </div>

      {/* Grille des 3 plans interactifs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {plansList.map((plan) => {
          const isCurrentPlan =
            effectivePlanId === plan.id &&
            (plan.id === "free" || (countdown.isPaidActive && activeCycle === selectedCycle));
          const isHighlighted =
            highlightPlan
              ? plan.id === highlightPlan
              : focusedPlan === plan.id || (focusedPlan === "free" && Boolean(plan.popular));
          const priceXof =
            selectedCycle === "yearly" ? plan.yearlyPriceXof : plan.monthlyPriceXof;
          const regularYearlyXof = plan.monthlyPriceXof * 12;
          const monthlyEquivalent = Math.round(plan.yearlyPriceXof / 12);

          const isPaidSamePlanOtherCycle =
            plan.id !== "free" &&
            countdown.isPaidActive &&
            effectivePlanId === plan.id &&
            activeCycle !== selectedCycle;
          const isUpgradeToBusiness =
            plan.id === "business" &&
            countdown.isPaidActive &&
            effectivePlanId === "personal";

          return (
            <div
              key={plan.id}
              data-testid={`plan-card-${plan.id}`}
              onClick={() => setFocusedPlan(plan.id)}
              className={`group relative rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                isHighlighted
                  ? "bg-gradient-to-b from-[#1E3A5F] via-[#173052] to-[#0F233F] text-white border-2 border-sky-400 shadow-xl ring-2 ring-sky-400/20 hover:-translate-y-0.5"
                  : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              {/* Badge supérieur */}
              {isCurrentPlan ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Formule Actuelle</span>
                </div>
              ) : isHighlighted ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1 whitespace-nowrap">
                  <Sparkles className="w-3 h-3" />
                  <span>{plan.popular ? "Recommandé • " + plan.badge : plan.badge}</span>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-2 mb-3 pt-1">
                  <h3 className="text-lg font-extrabold flex items-center gap-1.5">
                    {plan.id === "business" && (
                      <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>{plan.name}</span>
                  </h3>
                  {!isHighlighted && !isCurrentPlan && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {plan.badge}
                    </span>
                  )}
                </div>

                {/* Prix dynamique */}
                <div className="mb-4">
                  {plan.id !== "free" && selectedCycle === "yearly" && (
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs line-through ${
                          isHighlighted ? "text-slate-300/80" : "text-slate-400"
                        }`}
                      >
                        {regularYearlyXof.toLocaleString("fr-FR")} FCFA
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                        -{plan.yearlySavingsXof.toLocaleString("fr-FR")} FCFA
                      </span>
                    </div>
                  )}

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {priceXof.toLocaleString("fr-FR")} FCFA
                    </span>
                    {plan.id !== "free" && (
                      <span
                        className={`text-xs font-medium ${
                          isHighlighted ? "text-slate-300" : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        / {selectedCycle === "yearly" ? "an" : "mois"}
                      </span>
                    )}
                  </div>

                  {plan.id !== "free" && selectedCycle === "yearly" ? (
                    <p className="text-xs font-semibold text-emerald-400 mt-1">
                      Soit {monthlyEquivalent.toLocaleString("fr-FR")} FCFA/mois (2 mois offerts)
                    </p>
                  ) : (
                    <p
                      className={`text-xs mt-1 ${
                        isHighlighted ? "text-slate-300" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {plan.id === "free"
                        ? "Gratuit à vie • Budget, Revenus, Entrées & Dépenses"
                        : `Ou ${plan.yearlyPriceXof.toLocaleString("fr-FR")} FCFA / an (2 mois offerts)`}
                    </p>
                  )}
                </div>

                {!compact && (
                  <p
                    className={`text-xs leading-relaxed mb-4 pb-4 border-b ${
                      isHighlighted
                        ? "text-slate-200 border-white/15"
                        : "text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800"
                    }`}
                  >
                    {plan.description}
                  </p>
                )}

                {/* Fonctionnalités incluses & cadenassées */}
                <ul className="space-y-2.5 mb-5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-xs">
                      <Check
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isHighlighted
                            ? "text-emerald-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      />
                      <span>{feat}</span>
                    </li>
                  ))}
                  {plan.lockedFeatures?.map((locked) => (
                    <li
                      key={locked}
                      className={`flex items-start gap-2 text-xs opacity-60 line-through ${
                        isHighlighted ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{locked}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Boutons d'action dynamiques */}
              <div onClick={(e) => e.stopPropagation()}>
                {plan.id === "free" ? (
                  !isAdminUser && (countdown.needsPlanChoice || countdown.isTrialActive) ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isChoosingFree}
                      onClick={handleChooseFree}
                      className="cursor-pointer w-full rounded-xl text-xs font-bold h-11 gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                    >
                      {isChoosingFree ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Activation en cours...</span>
                        </>
                      ) : (
                        <>
                          <span>Choisir Gratuit (Budget, Entrées &amp; Dépenses)</span>
                          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full rounded-xl text-xs font-bold h-11 gap-1.5"
                    >
                      {effectivePlanId === "free" ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>Formule Actuelle (Gratuit)</span>
                        </>
                      ) : (
                        <span>Inclus de base</span>
                      )}
                    </Button>
                  )
                ) : isCurrentPlan ? (
                  <Button
                    disabled
                    className="w-full rounded-xl text-xs font-bold h-11 bg-emerald-600 text-white gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Abonnement Actif</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => openCheckout(plan.id as PaidSubscriptionPlanId)}
                    className={`cursor-pointer w-full rounded-xl text-xs sm:text-sm font-bold h-11 gap-2 transition-all active:scale-[0.98] ${
                      isHighlighted
                        ? "bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 text-slate-950 shadow-md shadow-sky-500/25"
                        : "bg-[#1E3A5F] hover:bg-[#162C49] text-white dark:bg-sky-600 dark:hover:bg-sky-500 shadow-sm"
                    }`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span>
                      {isPaidSamePlanOtherCycle
                        ? `Passer en ${selectedCycle === "yearly" ? "Annuel" : "Mensuel"} • ${priceXof.toLocaleString("fr-FR")} F`
                        : isUpgradeToBusiness
                        ? `Passer à Entreprise • ${priceXof.toLocaleString("fr-FR")} F/${selectedCycle === "yearly" ? "an" : "mois"}`
                        : `Souscrire via ${selectedGateway.shortLabel} • ${priceXof.toLocaleString("fr-FR")} F/${selectedCycle === "yearly" ? "an" : "mois"}`}
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bandeau de réassurance Moneriz */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Paiement chiffré en FCFA (XOF) via Moneriz • Activation instantanée après confirmation
        </span>
      </div>

      {/* Fenêtre modale / Bottom Sheet de paiement Liveframe Moneriz */}
      <Dialog
        open={checkoutTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (redirectTimerRef.current !== null) {
              window.clearTimeout(redirectTimerRef.current);
              redirectTimerRef.current = null;
            }
            setCheckoutTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Passerelle Sécurisée Moneriz</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Réglez directement dans MonBudget en FCFA (XOF) par {selectedGateway.label} ou tout autre moyen disponible. Votre accès sera débloqué dès confirmation serveur.
            </DialogDescription>
          </DialogHeader>

          {checkoutTarget && (
            <MonerizLiveframe
              planId={checkoutTarget}
              billingCycle={selectedCycle}
              preferredGatewayLabel={selectedGateway.label}
              onSuccess={() => {
                if (redirectTimerRef.current !== null) {
                  window.clearTimeout(redirectTimerRef.current);
                }
                redirectTimerRef.current = window.setTimeout(() => {
                  setCheckoutTarget(null);
                  router.push("/dashboard");
                  router.refresh();
                }, 1200);
              }}
              onCancel={() => {
                if (redirectTimerRef.current !== null) {
                  window.clearTimeout(redirectTimerRef.current);
                  redirectTimerRef.current = null;
                }
                setCheckoutTarget(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
