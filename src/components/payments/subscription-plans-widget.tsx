"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Sparkles, ShieldCheck, Crown } from "lucide-react";
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
  MONBUDGET_PLANS,
  PaidSubscriptionPlanId,
  SubscriptionPlanId,
} from "@/lib/moneriz-plans";
import { useUIStore } from "@/lib/store/ui-store";
import { MonerizLiveframe } from "@/components/payments/moneriz-liveframe";

interface SubscriptionPlansWidgetProps {
  highlightPlan?: PaidSubscriptionPlanId;
  compact?: boolean;
}

export function SubscriptionPlansWidget({
  highlightPlan,
  compact = false,
}: SubscriptionPlansWidgetProps) {
  const router = useRouter();
  const { subscriptionPlan, billingCycle: activeCycle } = useUIStore();
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");
  const [checkoutTarget, setCheckoutTarget] = useState<PaidSubscriptionPlanId | null>(null);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const plansList = [
    MONBUDGET_PLANS.free,
    MONBUDGET_PLANS.personal,
    MONBUDGET_PLANS.business,
  ];

  return (
    <div className="space-y-6">
      {/* Bascule Mensuel / Annuel (-2 mois offerts) */}
      <div className="flex flex-col items-center justify-center gap-2">
        <div
          role="group"
          aria-label="Périodicité de facturation"
          className="inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700"
        >
          <button
            type="button"
            onClick={() => setSelectedCycle("monthly")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              selectedCycle === "monthly"
                ? "bg-[#1E3A5F] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setSelectedCycle("yearly")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              selectedCycle === "yearly"
                ? "bg-[#1E3A5F] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Annuel</span>
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-500 text-white">
              2 mois offerts
            </span>
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          {selectedCycle === "yearly"
            ? "Payez 10 mois au lieu de 12 : économisez 2 mois complets sur votre abonnement annuel."
            : "Passez à l'abonnement annuel pour bénéficier de 2 mois offerts automatiquement."}
        </p>
      </div>

      {/* Grille des 3 plans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {plansList.map((plan) => {
          const isCurrentPlan =
            subscriptionPlan === plan.id &&
            (plan.id === "free" || activeCycle === selectedCycle);
          const isHighlighted =
            highlightPlan ? plan.id === highlightPlan : Boolean(plan.popular);
          const priceXof =
            selectedCycle === "yearly" ? plan.yearlyPriceXof : plan.monthlyPriceXof;

          return (
            <div
              key={plan.id}
              data-testid={`plan-card-${plan.id}`}
              className={`relative rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-all ${
                isHighlighted
                  ? "bg-gradient-to-b from-[#1E3A5F] to-[#0F233F] text-white border-2 border-sky-400 shadow-xl"
                  : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-xs"
              }`}
            >
              {isHighlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1 whitespace-nowrap">
                  <Sparkles className="w-3 h-3" />
                  <span>{plan.badge}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-lg font-extrabold flex items-center gap-1.5">
                    {plan.id === "business" && (
                      <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>{plan.name}</span>
                  </h3>
                  {!isHighlighted && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {plan.badge}
                    </span>
                  )}
                </div>

                {/* Prix */}
                <div className="mb-4">
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
                      Économie de {plan.yearlySavingsXof.toLocaleString("fr-FR")} FCFA (2 mois gratuits)
                    </p>
                  ) : (
                    <p
                      className={`text-xs mt-1 ${
                        isHighlighted ? "text-slate-300" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {plan.id === "free"
                        ? "Gratuit à vie • Entrées & Dépenses uniquement"
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

                {/* Fonctionnalités incluses */}
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

              {/* Bouton d'action */}
              <div>
                {plan.id === "free" ? (
                  <Button
                    disabled
                    variant="outline"
                    className="w-full rounded-xl text-xs font-bold h-11"
                  >
                    {subscriptionPlan === "free" ? "Formule Actuelle (Gratuit)" : "Inclus de base"}
                  </Button>
                ) : isCurrentPlan ? (
                  <Button
                    disabled
                    className="w-full rounded-xl text-xs font-bold h-11 bg-emerald-600 text-white"
                  >
                    Abonnement Actif
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setCheckoutTarget(plan.id as PaidSubscriptionPlanId)}
                    className={`w-full rounded-xl text-xs sm:text-sm font-bold h-11 transition-all ${
                      isHighlighted
                        ? "bg-sky-400 hover:bg-sky-300 text-slate-950 shadow-md"
                        : "bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white dark:bg-sky-600 dark:hover:bg-sky-500"
                    }`}
                  >
                    Souscrire via Moneriz ({priceXof.toLocaleString("fr-FR")} FCFA)
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bandeau de réassurance Moneriz */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Paiement Mobile Money & Carte sécurisé par Moneriz (XOF)
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
            <DialogTitle className="text-lg font-extrabold">
              Paiement Sécurisé Moneriz
            </DialogTitle>
            <DialogDescription className="text-xs">
              Réglez directement dans MonBudget en FCFA (XOF) par Mobile Money ou Carte Bancaire. Votre accès au tableau de bord sera ouvert dès confirmation serveur.
            </DialogDescription>
          </DialogHeader>

          {checkoutTarget && (
            <MonerizLiveframe
              planId={checkoutTarget}
              billingCycle={selectedCycle}
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

