import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSafeRedirectUrl, getSafeRequestOrigin } from '@/lib/utils/security'
import { sendWelcomeNotificationsOnce } from '@/lib/server/notifications'
import { getOrderAndSubscriptionStatus } from '@/lib/server/moneriz-app'

export { getSafeRedirectUrl }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const requestOrigin = getSafeRequestOrigin(request)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') || '/dashboard'
  const errorParam = searchParams.get('error_description') || searchParams.get('error')

  if (errorParam) {
    const errorUrl = new URL(`/login?error=${encodeURIComponent(errorParam)}`, requestOrigin)
    return NextResponse.redirect(errorUrl)
  }

  const supabase = await createClient()

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      if (type === 'recovery') {
        const redirectUrl = new URL('/reset-password', requestOrigin)
        return NextResponse.redirect(redirectUrl)
      }

      if (data?.user) {
        const user = data.user
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Membre'

        // Tâches de fond non bloquantes pour une ouverture immédiate (<100ms)
        void (async () => {
          try {
            await supabase.from('profiles').upsert(
              {
                id: user.id,
                full_name: fullName,
                currency: 'FCFA',
                alert_threshold_percent: 80,
                pay_day: 28,
              },
              { onConflict: 'id', ignoreDuplicates: true }
            )

            await getOrderAndSubscriptionStatus({
              userId: user.id,
              userEmail: user.email,
            }).catch(() => null)

            await sendWelcomeNotificationsOnce({
              userId: user.id,
              userEmail: user.email,
              fullName,
            }).catch(() => null)
          } catch (bgErr) {
            console.warn('[Auth Confirm] Background error:', bgErr)
          }
        })()
      }

      const redirectUrl = getSafeRedirectUrl(next, requestOrigin)
      return NextResponse.redirect(redirectUrl)
    }
  } else {
    // Si c'est l'échange de code OAuth (Google ou magic link)
    const code = searchParams.get('code')
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        if (data?.user) {
          const user = data.user
          const fullName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Membre'

          void (async () => {
            try {
              await supabase.from('profiles').upsert(
                {
                  id: user.id,
                  full_name: fullName,
                  currency: 'FCFA',
                  alert_threshold_percent: 80,
                  pay_day: 28,
                },
                { onConflict: 'id', ignoreDuplicates: true }
              )

              await getOrderAndSubscriptionStatus({
                userId: user.id,
                userEmail: user.email,
              }).catch(() => null)

              await sendWelcomeNotificationsOnce({
                userId: user.id,
                userEmail: user.email,
                fullName,
              }).catch(() => null)
            } catch (bgErr) {
              console.warn('[Auth Confirm Code] Background error:', bgErr)
            }
          })()
        }
        const redirectUrl = getSafeRedirectUrl(next, requestOrigin)
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  // Si l'utilisateur a déjà une session active, rediriger immédiatement vers l'application
  const { data: activeSession } = await supabase.auth.getUser()
  if (activeSession?.user) {
    const redirectUrl = getSafeRedirectUrl(next, requestOrigin)
    return NextResponse.redirect(redirectUrl)
  }

  // Passerelle de secours pour les liens Supabase implicites contenant les jetons dans le fragment # (jamais envoyé au serveur par HTTP)
  const defaultFallbackRedirect = getSafeRedirectUrl(next, requestOrigin).toString()
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Validation MonBudget</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0b1528; color: white;">
  <div style="text-align: center; padding: 24px;">
    <div style="width: 44px; height: 44px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #10b981; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px;"></div>
    <p style="font-size: 16px; font-weight: 500;">Validation de votre compte en cours...</p>
  </div>
  <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  <script>
    try {
      const hash = window.location.hash ? window.location.hash.substring(1) : '';
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          window.location.replace('/auth/callback?' + hash + '&next=' + encodeURIComponent('${encodeURIComponent(next)}'));
        } else {
          window.location.replace('/login?error=' + encodeURIComponent("Lien expiré ou déjà utilisé."));
        }
      } else {
        window.location.replace('${defaultFallbackRedirect}');
      }
    } catch (e) {
      window.location.replace('/login');
    }
  </script>
</body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    }
  )
}
