"use server"

import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { getSessionUser } from "@/lib/auth/session"
import {
  mintSupabaseRealtimeToken,
  type RealtimeToken,
} from "@/lib/supabase/realtime-jwt"

export async function getSupabaseRealtimeTokenAction(): Promise<
  ActionResult<RealtimeToken>
> {
  const user = await getSessionUser()
  if (!user) {
    return fail("UNAUTHORIZED", "UNAUTHORIZED")
  }

  try {
    const token = await mintSupabaseRealtimeToken(user.id)
    return ok(token)
  } catch {
    return fail("INTERNAL", "INTERNAL")
  }
}
