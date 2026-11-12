export type SubscriptionPlanId = "free" | "personal" | "business";
export type PaidSubscriptionPlanId = "personal" | "business";
export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "canceled" | "expired";

export const TRIAL_DURATION_DAYS = 30;
export const DEFAULT_BUSINESS_MONTHLY_PRICE_XOF = 1500;

export interface MonerizPaymentGateway {
  id: "wave" | "orange_money" | "mtn_momo" | "moov_money" | "card";
  label: string;
  shortLabel: string;
  badgeClasses: string;
}

export const MONERIZ_PAYMENT_GATEWAYS: MonerizPaymentGateway[] = [
  {
    id: "wave",
    label: "Wave",
    shortLabel: "Wave",
    badgeClasses: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/40",
  },
  {
    id: "orange_money",
    label: "Orange Money",
    shortLabel: "Orange",
    badgeClasses: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-400/40",
  },
  {
    id: "mtn_momo",
    label: "MTN MoMo",
    shortLabel: "MTN",
    badgeClasses: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/40",
  },
  {
    id: "moov_money",
    label: "Moov Money",
    shortLabel: "Moov",
    badgeClasses: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/40",
  },
  {
    id: "card",
    label: "Visa / Mastercard",
    shortLabel: "Carte",
    badgeClasses: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40",
  },
];

export interface SubscriptionCountdownInfo {
  effectivePlanId: SubscriptionPlanId;
  rawPlanId: SubscriptionPlanId;
  status: SubscriptionStatus;
  isPaidPlan: boolean;
  isPaidActive: boolean;
  isTrialActive: boolean;
  isTrialExpiringSoon: boolean;
  isTrialExpired: boolean;
  needsPlanChoice: boolean;
  trialDaysRemaining: number | null;
  trialEndsAtMs: number | null;
  formattedTrialEndsAt: string | null;
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

/**
 * Lit le tarif mensuel officiel du plan Entreprise & Pro depuis les variables d'environnement
 * (par défaut 1 500 FCFA, rehaussable sans modifier le code ni altérer l'historique payé).
 */
export function getBusinessMonthlyPriceXof(): number {
  const raw =
    process.env.NEXT_PUBLIC_BUSINESS_MONTHLY_PRICE_XOF ??
    process.env.BUSINESS_MONTHLY_PRICE_XOF;
  if (!raw) return DEFAULT_BUSINESS_MONTHLY_PRICE_XOF;
  const parsed = Number(String(raw).trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1000) {
    return DEFAULT_BUSINESS_MONTHLY_PRICE_XOF;
  }
  return parsed;
}

export function getPlanCatalog(): Record<SubscriptionPlanId, PlanPricingTier> {
  const businessMonthly = getBusinessMonthlyPriceXof();
  const businessYearly = businessMonthly * 10;
  const businessSavings = businessMonthly * 2;

  return {
    free: {
      id: "free",
      name: "Gratuit",
      badge: "Essentiel",
      description:
        "Continuez gratuitement après vos 30 jours d'essai pour déclarer votre salaire, gérer votre budget et noter vos entrées et dépenses du quotidien.",
      monthlyPriceXof: 0,
      yearlyPriceXof: 0,
      yearlySavingsXof: 0,
      features: [
        "Page Budget complète : saisie du salaire, sources de revenus & enveloppes",
        "Saisie illimitée des Entrées (Revenus) et Dépenses",
        "Historique, recherche et filtrage des transactions",
        "Ajout rapide mobile (+) en 2 secondes",
        "Synchronisation cloud sécurisée & mode hors-ligne",
      ],
      lockedFeatures: [
        "Pilotage quotidien & Reste à vivre journalier",
        "Objectifs d'épargne & Cagnottes",
        "Gestionnaire des Dettes & Créances",
        "Rapports avancés & Exports PDF/CSV",
        "Stockage de reçus & justificatifs de dépenses",
        "Conseiller Financier IA",
      ],
    },
    personal: {
      id: "personal",
      name: "Particulier",
      badge: "Tout inclus (actuel)",
      description:
        "Débloque 100 % des fonctionnalités actuelles de MonBudget : budget, épargne, dettes, rapports, reçus et IA.",
      monthlyPriceXof: 500,
      yearlyPriceXof: 5000, // 2 mois offerts (10 x 500 FCFA au lieu de 6 000 FCFA)
      yearlySavingsXof: 1000,
      popular: true,
      features: [
        "Tout ce qui est inclus dans le plan Gratuit",
        "Enveloppes budgétaires illimitées & Reste à vivre journalier",
        "Objectifs d'épargne, cagnottes & suivi des versements",
        "Gestionnaire complet des Dettes & Créances (WhatsApp intégré)",
        "Rapports financiers détaillés & Exports officiels PDF / CSV",
        "Stockage illimité de reçus et justificatifs de dépenses",
        "Conseiller Financier IA personnalisé (diagnostic & coaching)",
      ],
      lockedFeatures: [],
    },
    business: {
      id: "business",
      name: "Entreprise & Pro",
      badge: "Évolutif Pro",
      description:
        "Pour les entrepreneurs, commerçants et équipes : tout du plan Particulier + support prioritaire et futurs modules dédiés Entreprise.",
      monthlyPriceXof: businessMonthly,
      yearlyPriceXof: businessYearly, // 2 mois offerts (10 mois facturés)
      yearlySavingsXof: businessSavings,
      features: [
        "Tout ce qui est inclus dans le plan Particulier",
        "Support prioritaire 7j/7 (WhatsApp & Email)",
        "Accès anticipé aux futurs modules dédiés Entreprise (multi-caisses, bilans pro, équipe)",
      ],
    },
  };
}

export const MONBUDGET_PLANS: Record<SubscriptionPlanId, PlanPricingTier> = getPlanCatalog();

export type ProtectedFeatureKey =
  | "budget"
  | "daily_pilotage"
  | "savings"
  | "debts"
  | "reports"
  | "advisor"
  | "receipts";

const FEATURE_REQUIRED_PLAN: Record<ProtectedFeatureKey, SubscriptionPlanId> = {
  budget: "free",
  daily_pilotage: "personal",
  savings: "personal",
  debts: "personal",
  reports: "personal",
  advisor: "personal",
  receipts: "personal",
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
 * Calcule le décompte d'essai gratuit 30 jours et/ou de validité d'abonnement payant.
 * - Pendant les 30 jours d'essai (sans choix gratuit déjà enregistré), `effectivePlanId` vaut `"personal"`.
 * - Après 30 jours ou choix du mode Gratuit, les outils payants sont cadenassés (`effectivePlanId = "free"`).
 * - Un plan payant expiré ou inactif retombe immédiatement sur `"free"`.
 * - Les Super-Administrateurs ne subissent jamais d'essai ni d'expiration.
 */
export function getSubscriptionCountdownInfo(params: {
  planId?: SubscriptionPlanId | null;
  status?: SubscriptionStatus | null;
  expiresAt?: string | null;
  trialEndsAt?: string | null;
  trialChoiceMadeAt?: string | null;
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
      isTrialActive: false,
      isTrialExpiringSoon: false,
      isTrialExpired: false,
      needsPlanChoice: false,
      trialDaysRemaining: null,
      trialEndsAtMs: null,
      formattedTrialEndsAt: null,
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

  const parsedTrialMs = params.trialEndsAt ? Date.parse(params.trialEndsAt) : NaN;
  const hasValidTrial = Boolean(params.trialEndsAt && Number.isFinite(parsedTrialMs));
  const trialEndsAtMs = hasValidTrial ? parsedTrialMs : null;
  const formattedTrialEndsAt = trialEndsAtMs !== null ? formatUtcDateFr(trialEndsAtMs) : null;
  const hasTrialChoiceMade = Boolean(params.trialChoiceMadeAt);

  if (rawPlanId === "free") {
    const isTrialActive =
      rawStatus === "active" &&
      trialEndsAtMs !== null &&
      !hasTrialChoiceMade &&
      trialEndsAtMs > nowMs;

    if (isTrialActive && trialEndsAtMs !== null) {
      const diffMs = Math.max(0, trialEndsAtMs - nowMs);
      const trialDaysRemaining = Math.max(1, Math.ceil(diffMs / 86_400_000));
      const hoursRemaining = Math.max(1, Math.ceil(diffMs / 3_600_000));
      const isTrialExpiringSoon = trialDaysRemaining <= 3;

      return {
        effectivePlanId: "personal",
        rawPlanId: "free",
        status: "active",
        isPaidPlan: false,
        isPaidActive: false,
        isTrialActive: true,
        isTrialExpiringSoon,
        isTrialExpired: false,
        needsPlanChoice: false,
        trialDaysRemaining,
        trialEndsAtMs,
        formattedTrialEndsAt,
        isExpired: false,
        isExpiringSoon: isTrialExpiringSoon,
        daysRemaining: trialDaysRemaining,
        hoursRemaining,
        expiresAtMs: trialEndsAtMs,
        formattedExpiresAt: formattedTrialEndsAt,
      };
    }

    const isTrialExpired =
      trialEndsAtMs !== null && !hasTrialChoiceMade && trialEndsAtMs <= nowMs;
    const expiredMarker =
      rawStatus === "expired" || (expiresAtMs !== null && expiresAtMs <= nowMs);

    return {
      effectivePlanId: "free",
      rawPlanId: "free",
      status: rawStatus === "canceled" ? "canceled" : expiredMarker ? "expired" : "active",
      isPaidPlan: false,
      isPaidActive: false,
      isTrialActive: false,
      isTrialExpiringSoon: false,
      isTrialExpired,
      needsPlanChoice: isTrialExpired,
      trialDaysRemaining: isTrialExpired ? 0 : null,
      trialEndsAtMs,
      formattedTrialEndsAt,
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
      isTrialActive: false,
      isTrialExpiringSoon: false,
      isTrialExpired: false,
      needsPlanChoice: false,
      trialDaysRemaining: null,
      trialEndsAtMs,
      formattedTrialEndsAt,
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
      isTrialActive: false,
      isTrialExpiringSoon: false,
      isTrialExpired: false,
      needsPlanChoice: false,
      trialDaysRemaining: null,
      trialEndsAtMs,
      formattedTrialEndsAt,
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
    isTrialActive: false,
    isTrialExpiringSoon: false,
    isTrialExpired: false,
    needsPlanChoice: false,
    trialDaysRemaining: null,
    trialEndsAtMs,
    formattedTrialEndsAt,
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
  const required = FEATURE_REQUIRED_PLAN[feature];
  return required === "free" ? "personal" : required;
}

/**
 * Calcule le montant officiel en XOF (entier >= 100) côté serveur.
 */
export function getServerPlanAmountXof(
  planId: PaidSubscriptionPlanId,
  billingCycle: BillingCycle
): { amount: number; currency: "XOF"; title: string } {
  const catalog = getPlanCatalog();
  const plan = catalog[planId];
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
