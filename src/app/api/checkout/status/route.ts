import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  commitMonerizInbox,
  getOrderAndSubscriptionStatus,
} from "@/lib/server/moneriz-app";
import { fetchMonerizPaymentById } from "@/lib/server/moneriz-checkout";
import { checkoutStatusQuerySchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const parsedQuery = checkoutStatusQuerySchema.safeParse({
      orderId: searchParams.get("orderId") || undefined,
      paymentId: searchParams.get("paymentId") || undefined,
      testUserId:
        process.env.NODE_ENV !== "production"
          ? searchParams.get("testUserId") || undefined
          : undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_QUERY",
            message: parsedQuery.error.issues[0]?.message || "Paramètres de requête invalides.",
          },
        },
        { status: 400 }
      );
    }

    const orderId = parsedQuery.data.orderId ?? null;
    const paymentId = parsedQuery.data.paymentId ?? null;
    const testUserId =
      process.env.NODE_ENV !== "production" ? parsedQuery.data.testUserId ?? null : null;

    const effectiveUserId = user?.id || testUserId;

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Non authentifié." } },
        { status: 401 }
      );
    }

    let state = await getOrderAndSubscriptionStatus({
      userId: effectiveUserId,
      userEmail: user?.email,
      orderId,
    });

    // Rapprochement serveur exceptionnel via GET /v1/payments/{id} si un paymentId est fourni et la commande n'est pas encore marquée paid
    if (paymentId && state.order && state.order.status !== "paid") {
      const remotePayment = await fetchMonerizPaymentById(paymentId);
      if (
        remotePayment &&
        remotePayment.status === "paid" &&
        remotePayment.reference === state.order.reference &&
        remotePayment.amount === state.order.amount &&
        remotePayment.currency === "XOF"
      ) {
        await commitMonerizInbox({
          id: `evt_reconcile_${remotePayment.id}`,
          type: "payment.succeeded",
          mode: remotePayment.mode,
          occurredAt: remotePayment.paidAt || new Date().toISOString(),
          payment: remotePayment,
        });

        state = await getOrderAndSubscriptionStatus({
          userId: effectiveUserId,
          userEmail: user?.email,
          orderId,
        });
      }
    }

    return NextResponse.json(state);
  } catch {
    return NextResponse.json(
      { error: { code: "STATUS_ERROR", message: "Impossible de vérifier l'état de la commande." } },
      { status: 500 }
    );
  }
}

