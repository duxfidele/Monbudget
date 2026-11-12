import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanCatalog } from "@/lib/moneriz-plans";
import { chooseFreePlanForUser } from "@/lib/server/moneriz-app";
import { createUserNotification } from "@/lib/server/notifications";

export async function POST() {
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

    const subscription = await chooseFreePlanForUser({
      userId: user.id,
      userEmail: user.email,
    });

    const personalMonthly = getPlanCatalog().personal.monthlyPriceXof
      .toLocaleString("fr-FR")
      .replace(/[\u00a0\u202f]/g, " ");

    await createUserNotification({
      userId: user.id,
      type: "system",
      title: "🔒 Mode Gratuit limité activé",
      message:
        `Vous continuez gratuitement pour vos Entrées & Dépenses. Les outils avancés restent cadenassés et peuvent être débloqués à tout moment dès ${personalMonthly} FCFA / mois.`,
      ctaHref: "/settings?tab=subscription&plan=personal",
    });

    return NextResponse.json(
      {
        success: true,
        subscription,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur serveur.";
    console.error("[choose-free] Error:", msg);
    return NextResponse.json(
      {
        error: {
          code: "CHOOSE_FREE_ERROR",
          message: "Impossible d'enregistrer votre choix pour le moment.",
        },
      },
      { status: 500 }
    );
  }
}
