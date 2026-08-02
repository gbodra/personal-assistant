import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { auth } from "@/lib/auth"
import { isSignupAllowed } from "@/lib/security/signup"

const SESSION_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
]

function clearSessionCookies(response: NextResponse) {
  for (const name of SESSION_COOKIE_PREFIXES) {
    response.cookies.set(name, "", { expires: new Date(0), path: "/" })
  }
  return response
}

async function getSessionSafely() {
  try {
    return await auth()
  } catch (error) {
    // Stale cookies encrypted with a previous AUTH_SECRET cause JWTSessionError.
    console.warn("[proxy] Ignoring invalid auth session", error)
    return null
  }
}

export async function proxy(request: NextRequest) {
  const session = await getSessionSafely()
  const { pathname } = request.nextUrl
  const isLoggedIn = !!session?.user

  if (pathname.startsWith("/signup") && !isSignupAllowed()) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin))
  }

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup")
  const isPublic =
    isAuthPage ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", request.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return clearSessionCookies(NextResponse.redirect(loginUrl))
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/focus", request.nextUrl.origin))
  }

  if (!session) {
    return clearSessionCookies(NextResponse.next())
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"],
}
