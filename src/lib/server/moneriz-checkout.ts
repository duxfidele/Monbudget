export interface MonerizCheckoutRequestSnapshot {
  amount: number;
  currency: "XOF";
  title: string;
  reference: string;
  integrationMode: "iframe" | "redirect";
  embedOrigin?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface MonerizCheckoutOrderRecord {
  id: string;
  userId: string;
  planId: "personal" | "business";
  billingCycle: "monthly" | "yearly";
  mode: "test" | "live";
  reference: string;
  amount: number;
  currency: "XOF";
  title: string;
  status: "pending" | "paid" | "failed" | "expired" | "reversed";
  idempotencyKey: string;
  requestSnapshot: MonerizCheckoutRequestSnapshot;
  checkoutSession?: MonerizCheckoutSessionResponse | null;
}

export interface MonerizCheckoutSessionResponse {
  id: string;
  mode: "test" | "live";
  status: "open" | "completed" | "expired";
  integrationMode: "iframe" | "redirect";
  checkoutUrl: string;
  embedUrl: string | null;
  amount: number;
  currency: "XOF";
  title: string;
  reference: string;
  expiresAt: string;
}

export class MonerizApiError extends Error {
  status: number;
  code: string;
  requestId?: string;

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message);
    this.name = "MonerizApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

const MONERIZ_API_BASE = (process.env.MONERIZ_API_BASE_URL || "https://api.moneriz.com").replace(/\/+$/, "");

/**
 * Détermine le mode Moneriz ('test' ou 'live') à partir du préfixe de la clé secrète.
 */
export function resolveMonerizMode(secretKey: string | undefined = process.env.MONERIZ_SECRET_KEY): "test" | "live" {
  if (secretKey?.startsWith("izp_live_sk_")) {
    return "live";
  }
  return "test";
}

/**
 * Crée une session de paiement Moneriz via POST /v1/checkout-sessions.
 * Respecte l'Idempotency-Key persistée et reste strictement dans le mode configuré
 * (aucun repli silencieux vers redirect lorsque le mode iframe Liveframe est demandé).
 */
export async function createMonerizCheckoutSession(
  order: MonerizCheckoutOrderRecord
): Promise<{
  session: MonerizCheckoutSessionResponse;
  usedFallbackRedirect: false;
  updatedIdempotencyKey?: string;
  updatedSnapshot?: MonerizCheckoutRequestSnapshot;
}> {
  const secretKey = process.env.MONERIZ_SECRET_KEY;
  if (!secretKey) {
    throw new MonerizApiError(
      "La variable serveur MONERIZ_SECRET_KEY n'est pas configurée.",
      503,
      "MISSING_MONERIZ_SECRET_KEY"
    );
  }

  let response: Response;
  let data: any = null;

  try {
    response = await fetch(`${MONERIZ_API_BASE}/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": order.idempotencyKey,
      },
      body: JSON.stringify(order.requestSnapshot),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    data = await response.json().catch(() => null);
  } catch {
    throw new MonerizApiError(
      "Délai dépassé lors de la connexion au terminal Moneriz. Veuillez réessayer dans un instant.",
      503,
      "CHECKOUT_RESULT_UNKNOWN"
    );
  }

  if (!response.ok || !data) {
    const errorCode = data?.error?.code || "CHECKOUT_SESSION_FAILED";
    const requestId = data?.error?.requestId;

    if (
      order.requestSnapshot.integrationMode === "iframe" &&
      (errorCode === "EMBED_ORIGIN_NOT_ALLOWED" || errorCode === "EMBED_NOT_CONFIGURED")
    ) {
      const originLabel = order.requestSnapshot.embedOrigin || "cette application";
      throw new MonerizApiError(
        `Le paiement intégré (Liveframe) n'est pas encore autorisé pour ${originLabel} sur Moneriz. Ajoutez ${originLabel} dans Dashboard Moneriz → Intégration → Sites autorisés.`,
        400,
        errorCode,
        requestId
      );
    }

    if (response.status === 401 || response.status === 403) {
      const message =
        errorCode === "KYB_REQUIRED"
          ? "Les paiements en direct ne sont pas encore activés sur l'espace marchand Moneriz (vérification d'identité requise)."
          : "Le service de paiement Moneriz est momentanément indisponible côté serveur.";
      throw new MonerizApiError(message, 503, errorCode, requestId);
    }

    throw new MonerizApiError(
      data?.error?.message || "Impossible de créer la session de paiement Moneriz.",
      response.status,
      errorCode,
      requestId
    );
  }

  // Vérification d'intégrité stricte de la session retournée par Moneriz
  if (
    typeof data.id !== "string" ||
    !data.id.startsWith("cs_") ||
    data.mode !== order.mode ||
    Number(data.amount) !== order.amount ||
    data.currency !== order.currency ||
    data.reference !== order.reference ||
    data.integrationMode !== order.requestSnapshot.integrationMode ||
    typeof data.checkoutUrl !== "string" ||
    (order.requestSnapshot.integrationMode === "iframe" &&
      (typeof data.embedUrl !== "string" || !data.embedUrl))
  ) {
    throw new MonerizApiError(
      "Réponse de session Moneriz incohérente. Veuillez réessayer.",
      503,
      "CHECKOUT_RESULT_UNKNOWN",
      data?.error?.requestId
    );
  }

  return {
    session: data as MonerizCheckoutSessionResponse,
    usedFallbackRedirect: false,
  };
}

/**
 * Rapprochement serveur exceptionnel d'un paiement par son identifiant (GET /v1/payments/{id}).
 */
export async function fetchMonerizPaymentById(paymentId: string): Promise<{
  id: string;
  mode: "test" | "live";
  status: "pending" | "paid" | "failed" | "expired" | "reversed";
  amount: number;
  currency: "XOF";
  reference: string;
  paidAt: string | null;
} | null> {
  const secretKey = process.env.MONERIZ_SECRET_KEY;
  if (!secretKey || !paymentId) return null;

  try {
    const response = await fetch(`${MONERIZ_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

