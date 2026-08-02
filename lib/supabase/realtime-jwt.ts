import "server-only"

import { SignJWT } from "jose"

import { getServerEnv } from "@/lib/config/env"

const TOKEN_TTL_SECONDS = 30 * 60

export type RealtimeToken = {
  accessToken: string
  expiresAt: number
}

export async function mintSupabaseRealtimeToken(
  userId: string
): Promise<RealtimeToken> {
  const env = getServerEnv()
  const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS

  const accessToken = await new SignJWT({
    role: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret)

  return { accessToken, expiresAt }
}
