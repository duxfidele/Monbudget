import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSafeRedirectUrl } from '@/lib/utils/security'

export { getSafeRedirectUrl }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      if (type === 'recovery') {
        const redirectUrl = new URL('/reset-password', request.url)
        return NextResponse.redirect(redirectUrl)
      }
      // Rediriger de manière sécurisée vers un chemin interne uniquement (protection anti-Open Redirect)
      const redirectUrl = getSafeRedirectUrl(next, request.url)
      return NextResponse.redirect(redirectUrl)
    }
  } else {
    // Si c'est l'ancien format avec 'code'
    const code = searchParams.get('code')
    if (code) {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        const redirectUrl = getSafeRedirectUrl(next, request.url)
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  // En cas d'erreur de vérification, on redirige vers le login avec une erreur
  const errorUrl = new URL('/login?error=Échec de la vérification de l\'email', request.url)
  return NextResponse.redirect(errorUrl)
}
