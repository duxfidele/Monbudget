import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname
  const isHomePage = pathname === '/'
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
                      pathname.startsWith('/auth/confirm')
  const isPublicRoute = isHomePage || isAuthRoute || isPwaOrStatic

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

  // Si un cookie Supabase est présent, vérification avec timeout de sécurité
  let user = null
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

    // Timeout de 2.5 secondes max pour ne jamais bloquer le rendu
    const timeoutPromise = new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 2500)
    )

    const userPromise = supabase.auth.getUser()
    const result = await Promise.race([userPromise, timeoutPromise])
    user = result?.data?.user || null
  } catch (err) {
    console.warn("Middleware Supabase auth error or network timeout:", err)
    user = null
  }

  // Protection des routes privées
  if (!user && !isPublicRoute) {
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
