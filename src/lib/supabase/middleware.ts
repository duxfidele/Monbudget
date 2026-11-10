import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname

  // Fast-path immédiat pour les webhooks signés (ex: Moneriz) et la sonde santé
  if (pathname.startsWith('/api/webhooks/') || pathname === '/api/health') {
    return supabaseResponse
  }

  const isHomePage = pathname === '/'
  const isSupportPage = pathname.startsWith('/support')
  const isLegalPage =
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/conditions') ||
    pathname.startsWith('/confidentialite')
  const isApiRoute = pathname.startsWith('/api/')
  const isPwaOrStatic =
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname.startsWith('/icons/') ||
    pathname === '/favicon.ico'
  const isGuestOnlyAuthRoute = pathname.startsWith('/login') || 
                               pathname.startsWith('/register') ||
                               pathname.startsWith('/forgot-password')
  const isAuthRoute = isGuestOnlyAuthRoute ||
                      pathname.startsWith('/reset-password') ||
                      pathname.startsWith('/auth/confirm') ||
                      pathname.startsWith('/auth/callback')
  const isPublicRoute = isHomePage || isSupportPage || isLegalPage || isAuthRoute || isPwaOrStatic || isApiRoute

  const allCookies = request.cookies.getAll()
  const hasAuthCookie = allCookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  // Fast-path: Si aucun cookie Supabase n'est présent, résolution instantanée (0ms)
  if (!hasAuthCookie) {
    if (isPublicRoute) {
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si un cookie Supabase est présent, vérification avec distinction réseau vs rejet explicite
  let user = null
  let networkUnavailable = false
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Timeout de 2.5 secondes max pour ne jamais bloquer le rendu hors-ligne
    const timeoutPromise = new Promise<{ data: { user: null }; timedOut: true }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null }, timedOut: true }), 2500)
    )

    const userPromise = supabase.auth.getUser().then((res) => ({
      ...res,
      timedOut: false as const,
    }))
    const result = await Promise.race([userPromise, timeoutPromise])
    if (result.timedOut) {
      networkUnavailable = true
    } else if (result.error) {
      const errMsg = (result.error.message || '').toLowerCase()
      if (
        errMsg.includes('fetch') ||
        errMsg.includes('network') ||
        errMsg.includes('timeout') ||
        errMsg.includes('enotfound') ||
        errMsg.includes('econnrefused')
      ) {
        networkUnavailable = true
      }
    }
    user = result?.data?.user || null
  } catch (err) {
    console.warn("Middleware Supabase auth error or network timeout:", err)
    networkUnavailable = true
    user = null
  }

  // Protection des routes privées : en cas de coupure réseau avec cookie de session présent,
  // autoriser le démarrage en mode Offline-First local (les APIs serveur restent protégées).
  if (!user && !isPublicRoute) {
    if (networkUnavailable && hasAuthCookie) {
      supabaseResponse.headers.set('x-monbudget-offline-session', '1')
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirection des utilisateurs déjà connectés vers le dashboard (sauf sur /reset-password et /auth/confirm)
  if (user && isGuestOnlyAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
