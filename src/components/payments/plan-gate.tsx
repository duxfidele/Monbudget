"use client";

import React from "react";
import Link from "next/link";
import { Lock, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store/ui-store";
import {
  canAccessFeature,
  getRequiredPlanForFeature,
  MONBUDGET_PLANS,
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
  const { subscriptionPlan, isAdminUser } = useUIStore();

  const isAllowed = isAdminUser || canAccessFeature(subscriptionPlan, feature);
  if (isAllowed) {
    return <>{children}</>;
  }

  const requiredPlanId = getRequiredPlanForFeature(feature);
  const requiredPlan = MONBUDGET_PLANS[requiredPlanId];

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
            <span>Fonctionnalité Réservée au Plan {requiredPlan.name}</span>
          </div>

          <Link href="/transactions">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs rounded-xl gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour aux Entrées & Dépenses (Gratuit)</span>
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
          <p className="text-xs text-sky-300 font-medium pt-1">
            Votre compte est actuellement sur le <strong>Plan Gratuit (Entrées & Dépenses uniquement)</strong>. Passez au plan <strong>{requiredPlan.name}</strong> dès{" "}
            <strong>{requiredPlan.monthlyPriceXof.toLocaleString("fr-FR")} FCFA / mois</strong> (ou{" "}
            <strong>{requiredPlan.yearlyPriceXof.toLocaleString("fr-FR")} FCFA / an</strong> avec 2 mois offerts) pour activer cet outil.
          </p>
        </div>
      </div>

      {/* Grille de choix des plans et paiement Moneriz */}
      <SubscriptionPlansWidget highlightPlan={requiredPlanId} />
    </div>
  );
}

