import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const ADMIN_ROUTES = new Set(['/users', '/enterprises', '/audit-logs'])
const LOGIN_PATH = '/login'

function isAdminRoute(pathname: string): boolean {
  return Array.from(ADMIN_ROUTES).some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('access_token')?.value

  // Static assets and API routes are not protected here.
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  let payload: { role?: string } | null = null
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.SECRET_KEY || '')
      const { payload: p } = await jwtVerify(token, secret)
      payload = p as { role?: string }
    } catch {
      // Invalid or expired token: treat as unauthenticated.
      payload = null
    }
  }

  const isAuthenticated = !!payload
  const isAdmin = payload?.role === 'admin'

  // Redirect authenticated users away from the login page.
  if (pathname === LOGIN_PATH) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Require authentication for all other routes.
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  }

  // Require admin role for admin-only routes.
  if (isAdminRoute(pathname) && !isAdmin) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)'],
}
