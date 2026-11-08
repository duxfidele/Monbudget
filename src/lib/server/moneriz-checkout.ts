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
 * Respecte l'Idempotency-Key persistée et bascule automatiquement en mode 'redirect'
 * si l'origine iframe n'est pas encore configurée dans le dashboard marchand.
 */
export async function createMonerizCheckoutSession(
  order: MonerizCheckoutOrderRecord
): Promise<{
  session: MonerizCheckoutSessionResponse;
  usedFallbackRedirect: boolean;
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

  const executeCall = async (
    idempotencyKey: string,
    snapshot: MonerizCheckoutRequestSnapshot
  ): Promise<Response> => {
    return fetch(`${MONERIZ_API_BASE}/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(snapshot),
      cache: "no-store",
    });
  };

  let response = await executeCall(order.idempotencyKey, order.requestSnapshot);
  let data = await response.json().catch(() => null);

  // Si l'origine courante n'est pas encore dans embedOrigins sur le dashboard Moneriz,
  // repli automatique sécurisé vers integrationMode = "redirect"
  if (
    !response.ok &&
    order.requestSnapshot.integrationMode === "iframe" &&
    (data?.error?.code === "EMBED_ORIGIN_NOT_ALLOWED" ||
      data?.error?.code === "EMBED_NOT_CONFIGURED")
  ) {
    const fallbackSnapshot: MonerizCheckoutRequestSnapshot = {
      ...order.requestSnapshot,
      integrationMode: "redirect",
    };
    delete fallbackSnapshot.embedOrigin;
    const fallbackKey = `${order.idempotencyKey}-redir`.slice(0, 120);

    response = await executeCall(fallbackKey, fallbackSnapshot);
    data = await response.json().catch(() => null);

    if (response.ok && data) {
      return {
        session: data as MonerizCheckoutSessionResponse,
        usedFallbackRedirect: true,
        updatedIdempotencyKey: fallbackKey,
        updatedSnapshot: fallbackSnapshot,
      };
    }
  }

  if (!response.ok || !data) {
    throw new MonerizApiError(
      data?.error?.message || "Impossible de créer la session de paiement Moneriz.",
      response.status,
      data?.error?.code || "CHECKOUT_SESSION_FAILED",
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
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

