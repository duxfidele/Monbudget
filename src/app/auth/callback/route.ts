import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectUrl, getSafeRequestOrigin } from "@/lib/utils/security";
import { translateAuthError } from "@/lib/utils/auth-errors";
import { sendWelcomeNotificationsOnce } from "@/lib/server/notifications";
import { getOrderAndSubscriptionStatus } from "@/lib/server/moneriz-app";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestOrigin = getSafeRequestOrigin(request);
  const code = searchParams.get("code");
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const next = searchParams.get("next") || "/welcome";
  const errorParam = searchParams.get("error_description") || searchParams.get("error");

  if (errorParam) {
    const friendlyError = translateAuthError(errorParam) || errorParam;
    const errorUrl = new URL(
      `/login?error=${encodeURIComponent(friendlyError)}`,
      requestOrigin
    );
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createClient();
  let sessionUser = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const friendlyError = translateAuthError(error.message) || error.message;
      const errorUrl = new URL(
        `/login?error=${encodeURIComponent(friendlyError)}`,
        requestOrigin
      );
      return NextResponse.redirect(errorUrl);
    }
    sessionUser = data?.user || null;
  } else if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (!error) {
      sessionUser = data?.user || null;
    }
  }

  if (sessionUser) {
    // Tâches asynchrones en arrière-plan non bloquantes pour une redirection instantanée (<100ms)
    const user = sessionUser;
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Membre";

    void (async () => {
      try {
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            full_name: fullName,
            currency: "FCFA",
            alert_threshold_percent: 80,
            pay_day: 28,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );

        await getOrderAndSubscriptionStatus({
          userId: user.id,
          userEmail: user.email,
        }).catch(() => null);

        await sendWelcomeNotificationsOnce({
          userId: user.id,
          userEmail: user.email,
          fullName,
        }).catch(() => null);
      } catch (profileErr) {
        console.warn("Notice: background profile init in callback", profileErr);
      }
    })();

    const redirectUrl = getSafeRedirectUrl(next, requestOrigin);
    return NextResponse.redirect(redirectUrl);
  }

  const errorUrl = new URL(
    "/login?error=" + encodeURIComponent("Échec de la connexion. Veuillez réessayer."),
    requestOrigin
  );
  return NextResponse.redirect(errorUrl);
}
