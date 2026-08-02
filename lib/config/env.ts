import { z } from "zod"

const envSchema = z
  .object({
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().url().optional(),
    AUTH_TRUST_HOST: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SUPABASE_JWT_SECRET: z.string().min(1),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().optional(),
  })
  .refine(
    (env) =>
      Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) ||
      Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    {
      message:
        "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    }
  )

export type ServerEnv = z.infer<typeof envSchema> & {
  supabasePublishableKey: string
}

let cached: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (cached) {
    return cached
  }

  const parsed = envSchema.safeParse({
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`
    )
  }

  const supabasePublishableKey =
    parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ""

  cached = {
    ...parsed.data,
    supabasePublishableKey,
  }
  return cached
}

export function getPublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      "",
  }
}
