import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { getServerEnv } from "@/lib/config/env"
import type { Database } from "@/lib/supabase/database.types"

type AppClient = SupabaseClient<Database, "app">
type NextAuthClient = SupabaseClient<Database, "next_auth">

let adminClient: SupabaseClient<Database> | null = null

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (adminClient) {
    return adminClient
  }

  const env = getServerEnv()

  adminClient = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )

  return adminClient
}

export function getNextAuthAdmin(): NextAuthClient {
  const env = getServerEnv()

  return createClient<Database, "next_auth">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: "next_auth" },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}

export function getAppAdmin(): AppClient {
  const env = getServerEnv()

  return createClient<Database, "app">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: "app" },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}
