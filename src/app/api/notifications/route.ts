import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notificationsMarkReadSchema } from "@/lib/validations";
import {
  evaluateAndSendUserSubscriptionAlerts,
  listUserNotifications,
  markUserNotificationsRead,
  sendWelcomeNotificationsOnce,
} from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Non authentifié." } },
        { status: 401 }
      );
    }

    const fullName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email?.split("@")[0] ||
      null;

    // Filet de sécurité idempotent : bienvenue 30j + alertes J-3 / J0 à la volée
    await sendWelcomeNotificationsOnce({
      userId: user.id,
      userEmail: user.email,
      fullName,
    });
    await evaluateAndSendUserSubscriptionAlerts({
      userId: user.id,
      userEmail: user.email,
      fullName,
    });

    const data = await listUserNotifications(user.id, 30);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: { code: "NOTIFICATIONS_ERROR", message: "Impossible de charger les notifications." } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Non authentifié." } },
        { status: 401 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = notificationsMarkReadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PAYLOAD",
            message: parsed.error.issues[0]?.message || "Paramètres invalides.",
          },
        },
        { status: 400 }
      );
    }

    await markUserNotificationsRead({
      userId: user.id,
      notificationId: parsed.data.notificationId,
      markAll: parsed.data.markAll,
    });

    const updated = await listUserNotifications(user.id, 30);
    return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: { code: "NOTIFICATIONS_ERROR", message: "Impossible de mettre à jour les notifications." } },
      { status: 500 }
    );
  }
}
