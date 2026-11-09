export type SubscriptionPlanId = "free" | "personal" | "business";
export type PaidSubscriptionPlanId = "personal" | "business";
export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "canceled" | "expired";

export interface SubscriptionCountdownInfo {
  effectivePlanId: SubscriptionPlanId;
  rawPlanId: SubscriptionPlanId;
  status: SubscriptionStatus;
  isPaidPlan: boolean;
  isPaidActive: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  expiresAtMs: number | null;
  formattedExpiresAt: string | null;
}

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
      "Stockage de reçus & justificatifs de dépenses",
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
      "Stockage de reçus & justificatifs de dépenses",
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
  | "advisor"
  | "receipts";

const FEATURE_REQUIRED_PLAN: Record<ProtectedFeatureKey, PaidSubscriptionPlanId> = {
  budget: "personal",
  savings: "personal",
  debts: "personal",
  reports: "business",
  advisor: "business",
  receipts: "business",
};

const PLAN_RANK: Record<SubscriptionPlanId, number> = {
  free: 0,
  personal: 1,
  business: 2,
};

function formatUtcDateFr(ms: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));
}

/**
 * Calcule le décompte de validité d'un abonnement et retourne le plan effectif.
 * Un plan payant expiré (currentPeriodEnd <= now) ou inactif retombe immédiatement sur "free".
 * Les Super-Administrateurs ne subissent jamais d'expiration.
 */
export function getSubscriptionCountdownInfo(params: {
  planId?: SubscriptionPlanId | null;
  status?: SubscriptionStatus | null;
  expiresAt?: string | null;
  isAdmin?: boolean;
  now?: number | Date;
}): SubscriptionCountdownInfo {
  const nowMs =
    typeof params.now === "number"
      ? params.now
      : params.now instanceof Date
      ? params.now.getTime()
      : Date.now();

  if (params.isAdmin) {
    return {
      effectivePlanId: "business",
      rawPlanId: "business",
      status: "active",
      isPaidPlan: true,
      isPaidActive: true,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      hoursRemaining: null,
      expiresAtMs: null,
      formattedExpiresAt: null,
    };
  }

  const rawPlanId: SubscriptionPlanId = params.planId || "free";
  const rawStatus: SubscriptionStatus = params.status || "active";
  const parsedExpiresMs = params.expiresAt ? Date.parse(params.expiresAt) : NaN;
  const hasValidExpiry = Boolean(params.expiresAt && Number.isFinite(parsedExpiresMs));
  const hasInvalidExpiry = Boolean(params.expiresAt && !Number.isFinite(parsedExpiresMs));
  const expiresAtMs = hasValidExpiry ? parsedExpiresMs : null;
  const formattedExpiresAt = expiresAtMs !== null ? formatUtcDateFr(expiresAtMs) : null;

  if (rawPlanId === "free") {
    const expiredMarker =
      rawStatus === "expired" || (expiresAtMs !== null && expiresAtMs <= nowMs);
    return {
      effectivePlanId: "free",
      rawPlanId: "free",
      status: rawStatus === "canceled" ? "canceled" : expiredMarker ? "expired" : "active",
      isPaidPlan: false,
      isPaidActive: false,
      isExpired: expiredMarker,
      isExpiringSoon: false,
      daysRemaining: expiresAtMs !== null && expiredMarker ? 0 : null,
      hoursRemaining: expiresAtMs !== null && expiredMarker ? 0 : null,
      expiresAtMs,
      formattedExpiresAt,
    };
  }

  const isDateExpired = expiresAtMs !== null && expiresAtMs <= nowMs;
  if (rawStatus !== "active" || isDateExpired || hasInvalidExpiry) {
    return {
      effectivePlanId: "free",
      rawPlanId,
      status: rawStatus === "canceled" ? "canceled" : "expired",
      isPaidPlan: false,
      isPaidActive: false,
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: expiresAtMs !== null ? 0 : null,
      hoursRemaining: expiresAtMs !== null ? 0 : null,
      expiresAtMs,
      formattedExpiresAt,
    };
  }

  if (expiresAtMs !== null) {
    const diffMs = Math.max(0, expiresAtMs - nowMs);
    const daysRemaining = Math.max(1, Math.ceil(diffMs / 86_400_000));
    const hoursRemaining = Math.max(1, Math.ceil(diffMs / 3_600_000));
    return {
      effectivePlanId: rawPlanId,
      rawPlanId,
      status: "active",
      isPaidPlan: true,
      isPaidActive: true,
      isExpired: false,
      isExpiringSoon: daysRemaining <= 5,
      daysRemaining,
      hoursRemaining,
      expiresAtMs,
      formattedExpiresAt,
    };
  }

  return {
    effectivePlanId: rawPlanId,
    rawPlanId,
    status: "active",
    isPaidPlan: true,
    isPaidActive: true,
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining: null,
    hoursRemaining: null,
    expiresAtMs: null,
    formattedExpiresAt: null,
  };
}

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

