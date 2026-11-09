"use client";

import React from "react";
import Link from "next/link";
import { Lock, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store/ui-store";
import {
  canAccessFeature,
  getPlanCatalog,
  getRequiredPlanForFeature,
  getSubscriptionCountdownInfo,
  ProtectedFeatureKey,
} from "@/lib/moneriz-plans";
import { SubscriptionPlansWidget } from "@/components/payments/subscription-plans-widget";

interface PlanGateProps {
  feature: ProtectedFeatureKey;
  featureTitle: string;
  featureDescription: string;
  children: React.ReactNode;
}

export function PlanGate({
  feature,
  featureTitle,
  featureDescription,
  children,
}: PlanGateProps) {
  const {
    subscriptionHydrated,
    subscriptionPlan,
    subscriptionStatus,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdminUser,
  } = useUIStore();

  const countdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: isAdminUser,
  });

  const isAllowed = isAdminUser || canAccessFeature(countdown.effectivePlanId, feature);
  if (isAllowed) {
    return <>{children}</>;
  }

  if (!subscriptionHydrated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] gap-3 text-slate-500 dark:text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
        <p className="text-sm font-medium">Vérification de votre accès en cours...</p>
      </div>
    );
  }

  const requiredPlanId = getRequiredPlanForFeature(feature);
  const catalog = getPlanCatalog();
  const requiredPlan = catalog[requiredPlanId];

  return (
    <div
      data-testid={`plan-gate-${feature}`}
      className="flex flex-col gap-6 pb-16 max-w-5xl mx-auto"
    >
      {/* Bannière explicative du verrouillage */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#0F233F] via-[#162F54] to-[#1E3A5F] text-white border border-sky-400/30 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            <span>
              {countdown.isTrialExpired
                ? `Essai 30 jours terminé — Abonnement ${requiredPlan.name} (1 000 FCFA) Requis`
                : countdown.isExpired
                ? `Abonnement Expiré — Plan ${requiredPlan.name} (1 000 FCFA) Requis`
                : `Fonctionnalité Cadenassée — Plan ${requiredPlan.name} (1 000 FCFA/mois)`}
            </span>
          </div>

          <Link href="/transactions">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs rounded-xl gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour aux Entrées &amp; Dépenses (Gratuit)</span>
            </Button>
          </Link>
        </div>

        <div className="space-y-2 max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-sky-400 shrink-0" />
            <span>Débloquez « {featureTitle} »</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            {featureDescription}
          </p>
          <p suppressHydrationWarning className="text-xs text-sky-300 font-medium pt-1">
            {countdown.isTrialExpired ? (
              <>
                Vos 30 jours d&apos;essai gratuit complet sont arrivés à terme
                {countdown.formattedTrialEndsAt ? ` le ${countdown.formattedTrialEndsAt}` : ""}. Prenez l&apos;abonnement{" "}
                <strong>{requiredPlan.name} à {requiredPlan.monthlyPriceXof.toLocaleString("fr-FR")} FCFA / mois</strong> (ou{" "}
                <strong>{requiredPlan.yearlyPriceXof.toLocaleString("fr-FR")} FCFA / an</strong>) pour débloquer immédiatement cet outil et toutes les fonctionnalités actuelles.
              </>
            ) : countdown.isExpired ? (
              <>
                Votre abonnement précédent est arrivé à échéance
                {countdown.formattedExpiresAt ? ` le ${countdown.formattedExpiresAt}` : ""} et votre compte est repassé sur le{" "}
                <strong>Plan Gratuit</strong>. Renouvelez votre plan <strong>{requiredPlan.name}</strong> dès{" "}
                <strong>{requiredPlan.monthlyPriceXof.toLocaleString("fr-FR")} FCFA / mois</strong> (ou{" "}
                <strong>{requiredPlan.yearlyPriceXof.toLocaleString("fr-FR")} FCFA / an</strong>) pour réactiver cet outil.
              </>
            ) : (
              <>
                Votre compte est actuellement sur le <strong>Plan Gratuit (Entrées &amp; Dépenses uniquement)</strong>. Prenez un abonnement <strong>{requiredPlan.name} à {requiredPlan.monthlyPriceXof.toLocaleString("fr-FR")} FCFA / mois</strong> (ou{" "}
                <strong>{requiredPlan.yearlyPriceXof.toLocaleString("fr-FR")} FCFA / an</strong> avec 2 mois offerts) pour activer cet outil.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Grille de choix des plans et paiement Moneriz */}
      <SubscriptionPlansWidget highlightPlan={requiredPlanId} />
    </div>
  );
}

