import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSafeRedirectUrl, getSafeRequestOrigin } from '@/lib/utils/security'
import { sendWelcomeNotificationsOnce } from '@/lib/server/notifications'

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
        try {
          const user = data.user
          const fullName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Membre'

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

          await sendWelcomeNotificationsOnce({
            userId: user.id,
            userEmail: user.email,
            fullName,
          }).catch(() => null)
        } catch {}
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
          try {
            const user = data.user
            const fullName =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              'Membre'

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

            await sendWelcomeNotificationsOnce({
              userId: user.id,
              userEmail: user.email,
              fullName,
            }).catch(() => null)
          } catch {}
        }
        const redirectUrl = getSafeRedirectUrl(next, requestOrigin)
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  // En cas d'erreur de vérification, redirection claire vers /login
  const errorUrl = new URL('/login?error=' + encodeURIComponent("Échec de la validation du lien ou lien expiré."), requestOrigin)
  return NextResponse.redirect(errorUrl)
}
