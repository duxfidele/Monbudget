export type SubscriptionPlanId = "free" | "personal" | "business";
export type PaidSubscriptionPlanId = "personal" | "business";
export type BillingCycle = "monthly" | "yearly";

export interface PlanPricingTier {
  id: SubscriptionPlanId;
  name: string;
  badge: string;
  description: string;
  monthlyPriceXof: number;
  yearlyPriceXof: number; // 10 mois facturés = 2 mois offerts
  yearlySavingsXof: number;
  popular?: boolean;
  features: string[];
  lockedFeatures?: string[];
}

export const MONBUDGET_PLANS: Record<SubscriptionPlanId, PlanPricingTier> = {
  free: {
    id: "free",
    name: "Gratuit",
    badge: "Découverte",
    description: "Idéal pour noter vos entrées et vos dépenses au quotidien en toute simplicité.",
    monthlyPriceXof: 0,
    yearlyPriceXof: 0,
    yearlySavingsXof: 0,
    features: [
      "Saisie illimitée des Entrées (Revenus) et Dépenses",
      "Historique et recherche dans le journal des transactions",
      "Ajout rapide mobile (+) en 2 secondes",
      "Synchronisation cloud sécurisée & mode hors-ligne",
    ],
    lockedFeatures: [
      "Enveloppes budgétaires & Reste à vivre",
      "Objectifs d'épargne & Cagnottes",
      "Suivi des Dettes & Créances",
      "Rapports avancés & Exports PDF/CSV",
      "Conseiller Financier IA",
    ],
  },
  personal: {
    id: "personal",
    name: "Particulier",
    badge: "Le plus populaire",
    description: "Pour maîtriser votre salaire de A à Z : budget par enveloppes, épargne et suivi des dettes.",
    monthlyPriceXof: 1000,
    yearlyPriceXof: 10000, // 2 mois offerts (10 x 1 000 FCFA au lieu de 12 000 FCFA)
    yearlySavingsXof: 2000,
    popular: true,
    features: [
      "Tout ce qui est inclus dans le plan Gratuit",
      "Enveloppes budgétaires illimitées & alertes de seuil",
      "Calcul intelligent du Reste à vivre journalier jusqu'à la paie",
      "Objectifs d'épargne & projets avec suivi des versements",
      "Gestionnaire complet des Dettes & Créances (WhatsApp intégré)",
    ],
    lockedFeatures: [
      "Rapports financiers avancés & Exports PDF/CSV",
      "Conseiller Financier IA personnalisé",
    ],
  },
  business: {
    id: "business",
    name: "Entreprise & Pro",
    badge: "Tout inclus",
    description: "Pour les entrepreneurs, commerçants et foyers exigeants qui veulent des bilans complets et l'IA.",
    monthlyPriceXof: 2500,
    yearlyPriceXof: 25000, // 2 mois offerts (10 x 2 500 FCFA au lieu de 30 000 FCFA)
    yearlySavingsXof: 5000,
    features: [
      "Tout ce qui est inclus dans le plan Particulier",
      "Rapports financiers détaillés & analytique multi-mois",
      "Exports officiels illimités en PDF et Excel/CSV",
      "Conseiller Financier IA personnalisé (diagnostic & coaching)",
      "Stockage illimité de reçus et justificatifs de dépenses",
      "Gestion multi-sources de revenus ( Commerce, Honoraires, Salaire)",
      "Support prioritaire 7j/7",
    ],
  },
};

export type ProtectedFeatureKey =
  | "budget"
  | "savings"
  | "debts"
  | "reports"
  | "advisor";

const FEATURE_REQUIRED_PLAN: Record<ProtectedFeatureKey, PaidSubscriptionPlanId> = {
  budget: "personal",
  savings: "personal",
  debts: "personal",
  reports: "business",
  advisor: "business",
};

const PLAN_RANK: Record<SubscriptionPlanId, number> = {
  free: 0,
  personal: 1,
  business: 2,
};

/**
 * Vérifie si un plan donné autorise l'accès à une fonctionnalité.
 */
export function canAccessFeature(
  currentPlan: SubscriptionPlanId | undefined | null,
  feature: ProtectedFeatureKey
): boolean {
  const effectivePlan: SubscriptionPlanId = currentPlan || "free";
  const requiredPlan = FEATURE_REQUIRED_PLAN[feature];
  return PLAN_RANK[effectivePlan] >= PLAN_RANK[requiredPlan];
}

/**
 * Retourne le plan minimum requis pour débloquer une fonctionnalité.
 */
export function getRequiredPlanForFeature(feature: ProtectedFeatureKey): PaidSubscriptionPlanId {
  return FEATURE_REQUIRED_PLAN[feature];
}

/**
 * Calcule le montant officiel en XOF (entier >= 100) côté serveur.
 */
export function getServerPlanAmountXof(
  planId: PaidSubscriptionPlanId,
  billingCycle: BillingCycle
): { amount: number; currency: "XOF"; title: string } {
  const plan = MONBUDGET_PLANS[planId];
  if (!plan) {
    throw new Error("INVALID_PLAN");
  }

  const amount =
    billingCycle === "yearly" ? plan.yearlyPriceXof : plan.monthlyPriceXof;

  const cycleLabel =
    billingCycle === "yearly" ? "Annuel (-2 mois offerts)" : "Mensuel";

  return {
    amount,
    currency: "XOF",
    title: `Abonnement MonBudget ${plan.name} — ${cycleLabel}`,
  };
}

