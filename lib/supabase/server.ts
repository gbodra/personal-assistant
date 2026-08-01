import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Browser/user-scoped Supabase client (RLS).
 * Auth for this app is Auth.js — do not use this for login.
 * Prefer `getAppAdmin()` / `getNextAuthAdmin()` for Server Actions.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore when Proxy
            // is not refreshing Supabase Auth cookies.
          }
        },
      },
    }
  )
}
