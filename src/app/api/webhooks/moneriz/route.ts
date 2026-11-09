import { NextResponse } from "next/server";
import { verifyMonerizSignature } from "@/lib/server/moneriz-signature";
import {
  commitMonerizInbox,
  parseMonerizEvent,
} from "@/lib/server/moneriz-app";
import { sendPostPaymentConfirmationOnce } from "@/lib/server/notifications";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-moneriz-signature");

  if (
    !verifyMonerizSignature(
      rawBody,
      signature,
      process.env.MONERIZ_WEBHOOK_SECRET
    )
  ) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  try {
    const event = parseMonerizEvent(rawBody);
    const result = await commitMonerizInbox(event);
    if (event.type === "payment.succeeded" && event.payment.status === "paid" && result.orderStatus === "paid") {
      await sendPostPaymentConfirmationOnce({
        reference: event.payment.reference,
        mode: event.mode,
      }).catch(() => null);
    }
    return NextResponse.json(
      {
        received: true,
        duplicate: result.duplicate,
        orderStatus: result.orderStatus,
        planId: result.planId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    const msg = err?.message || "Invalid webhook payload";
    if (
      msg === "INVALID_EVENT_JSON" ||
      msg === "INVALID_EVENT_PAYLOAD" ||
      msg === "MODE_MISMATCH" ||
      msg === "AMOUNT_OR_CURRENCY_MISMATCH"
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

