import { SupabaseAdapter } from "@auth/supabase-adapter"
import bcrypt from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

import { getServerEnv } from "@/lib/config/env"
import {
  checkRateLimit,
  LOGIN_RATE_LIMIT,
} from "@/lib/security/rate-limit"
import { getNextAuthAdmin } from "@/lib/supabase/admin"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getServerEnv()

  return {
    secret: env.AUTH_SECRET,
    adapter: SupabaseAdapter({
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      secret: env.SUPABASE_SERVICE_ROLE_KEY,
    }),
    session: { strategy: "jwt" },
    pages: {
      signIn: "/login",
    },
    providers: [
      Credentials({
        name: "Email and Password",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(raw) {
          const parsed = credentialsSchema.safeParse(raw)
          if (!parsed.success) {
            return null
          }

          const email = parsed.data.email.toLowerCase()
          const rate = checkRateLimit(
            `login:${email}`,
            LOGIN_RATE_LIMIT.limit,
            LOGIN_RATE_LIMIT.windowMs
          )
          if (!rate.allowed) {
            return null
          }

          const { password } = parsed.data
          const supabase = getNextAuthAdmin()
          const { data: user, error } = await supabase
            .from("users")
            .select("id, name, email, image, password_hash")
            .eq("email", email)
            .maybeSingle()

          if (error || !user?.password_hash) {
            return null
          }

          const valid = await bcrypt.compare(password, user.password_hash)
          if (!valid) {
            return null
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          }
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user?.id) {
          token.sub = user.id
        }
        return token
      },
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub
        }
        return session
      },
    },
    trustHost: true,
  }
})
