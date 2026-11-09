import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createMonerizCheckoutSession,
  MonerizApiError,
} from "@/lib/server/moneriz-checkout";
import {
  prepareAuthorizedCheckout,
  saveCheckoutSession,
} from "@/lib/server/moneriz-app";
import { checkRateLimit, getClientIp } from "@/lib/server/anti-spam";
import { checkoutRequestSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const ipRate = checkRateLimit(`checkout:ip:${clientIp}`, {
      maxRequests: 25,
      windowMs: 10 * 60 * 1000,
    });

    if (!ipRate.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Trop de tentatives de paiement détectées. Veuillez patienter quelques minutes.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(ipRate.retryAfterSeconds) },
        }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { error: { code: "INVALID_PAYLOAD", message: "Corps de requête JSON invalide." } },
        { status: 400 }
      );
    }

    // Identification de l'utilisateur authentifié (avec support test E2E en environnement hors production)
    const testUserIdRaw =
      process.env.NODE_ENV !== "production" && typeof (rawBody as Record<string, unknown>).testUserId === "string"
        ? ((rawBody as Record<string, unknown>).testUserId as string)
        : null;
    const effectiveUserId = user?.id || testUserIdRaw;

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Veuillez vous connecter pour souscrire à un abonnement." } },
        { status: 401 }
      );
    }

    const userRate = checkRateLimit(`checkout:user:${effectiveUserId}`, {
      maxRequests: 15,
      windowMs: 10 * 60 * 1000,
    });

    if (!userRate.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Trop de sessions de paiement créées récemment. Veuillez patienter quelques minutes.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(userRate.retryAfterSeconds) },
        }
      );
    }

    const parsedBody = checkoutRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PAYLOAD",
            message: parsedBody.error.issues[0]?.message || "Paramètres de commande invalides.",
          },
        },
        { status: 400 }
      );
    }

    const { orderId, planId, billingCycle, integrationMode: preferredMode } = parsedBody.data;

    const headerOrigin = request.headers.get("origin");
    const requestOrigin = headerOrigin || new URL(request.url).origin;

    const { order, existingSession } = await prepareAuthorizedCheckout({
      userId: effectiveUserId,
      orderId,
      planId,
      billingCycle,
      requestOrigin,
      preferredMode,
    });

    if (
      existingSession &&
      (existingSession.integrationMode !== "iframe" || Boolean(existingSession.embedUrl))
    ) {
      return NextResponse.json(
        {
          orderId: order.id,
          reference: order.reference,
          amount: order.amount,
          currency: order.currency,
          id: existingSession.id,
          integrationMode: existingSession.integrationMode,
          checkoutUrl: existingSession.checkoutUrl,
          embedUrl: existingSession.embedUrl,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const {
      session,
      updatedIdempotencyKey,
      updatedSnapshot,
    } = await createMonerizCheckoutSession(order);

    await saveCheckoutSession(
      order.id,
      session,
      updatedIdempotencyKey,
      updatedSnapshot
    );

    return NextResponse.json(
      {
        orderId: order.id,
        reference: order.reference,
        amount: order.amount,
        currency: order.currency,
        id: session.id,
        integrationMode: session.integrationMode,
        checkoutUrl: session.checkoutUrl,
        embedUrl: session.embedUrl,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (err instanceof MonerizApiError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            requestId: err.requestId,
          },
        },
        { status: err.status }
      );
    }

    if (err?.message === "FORBIDDEN_ORDER") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN_ORDER", message: "Cette commande ne vous appartient pas." } },
        { status: 403 }
      );
    }

    if (err?.message === "ORDER_ALREADY_PAID") {
      return NextResponse.json(
        { error: { code: "ORDER_ALREADY_PAID", message: "Cette commande a déjà été réglée." } },
        { status: 409 }
      );
    }

    if (err?.message === "INVALID_PLAN") {
      return NextResponse.json(
        { error: { code: "INVALID_PLAN", message: "Formule d'abonnement invalide." } },
        { status: 400 }
      );
    }

    if (err?.message === "MISSING_SERVICE_ROLE_KEY") {
      console.error(
        "[Checkout] MISSING_SERVICE_ROLE_KEY — NEXT_PUBLIC_SUPABASE_URL:",
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
        "SUPABASE_SERVICE_ROLE_KEY:",
        Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
      );
      return NextResponse.json(
        {
          error: {
            code: "SERVER_CONFIG_ERROR",
            message:
              "Le service de paiement n'est pas encore configuré côté serveur (paramètres serveur absents sur ce déploiement).",
          },
        },
        { status: 503 }
      );
    }

    if (
      err?.message?.startsWith("ORDER_PERSISTENCE_FAILED:") ||
      err?.message?.startsWith("ORDER_FETCH_FAILED:")
    ) {
      console.error("[Checkout] Supabase subscription_orders error:", err.message);
      return NextResponse.json(
        {
          error: {
            code: "ORDER_STORAGE_ERROR",
            message:
              "Impossible d'enregistrer ou de lire la commande d'abonnement côté base de données.",
          },
        },
        { status: 503 }
      );
    }

    console.error("[Checkout] Unexpected error:", err?.message || err);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Une erreur serveur est survenue lors de la préparation du paiement.",
        },
      },
      { status: 500 }
    );
  }
}

