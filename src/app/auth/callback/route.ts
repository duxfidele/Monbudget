import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectUrl } from "@/lib/utils/security";
import { translateAuthError } from "@/lib/utils/auth-errors";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/welcome";
  const errorParam = searchParams.get("error_description") || searchParams.get("error");

  if (errorParam) {
    const friendlyError = translateAuthError(errorParam) || errorParam;
    const errorUrl = new URL(
      `/login?error=${encodeURIComponent(friendlyError)}`,
      request.url
    );
    return NextResponse.redirect(errorUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // Garantir l'initialisation du profil utilisateur s'il n'existe pas encore
      try {
        const user = data.user;
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Membre";

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
      } catch (profileErr) {
        console.warn("Notice: could not pre-create profile in callback", profileErr);
      }

      const redirectUrl = getSafeRedirectUrl(next, request.url);
      return NextResponse.redirect(redirectUrl);
    }

    if (error) {
      const friendlyError = translateAuthError(error.message) || error.message;
      const errorUrl = new URL(
        `/login?error=${encodeURIComponent(friendlyError)}`,
        request.url
      );
      return NextResponse.redirect(errorUrl);
    }
  }

  const errorUrl = new URL(
    "/login?error=" + encodeURIComponent("Échec de la connexion. Veuillez réessayer."),
    request.url
  );
  return NextResponse.redirect(errorUrl);
}
