"use server"

import bcrypt from "bcryptjs"
import { AuthError } from "next-auth"
import { z } from "zod"

import { signIn } from "@/lib/auth"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { ensureDefaultBoard } from "@/features/kanban/data/board-repository"
import { getNextAuthAdmin } from "@/lib/supabase/admin"

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
})

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
})

export async function signupAction(
  input: z.infer<typeof signupSchema>
): Promise<ActionResult<{ email: string }>> {
  const parsed = signupSchema.safeParse(input)
  if (!parsed.success) {
    return fail("VALIDATION", "Invalid signup data")
  }

  const email = parsed.data.email.toLowerCase()
  const supabase = getNextAuthAdmin()

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (existing) {
    return fail("CONFLICT", "EMAIL_TAKEN")
  }

  const password_hash = await bcrypt.hash(parsed.data.password, 12)

  const { data: user, error } = await supabase
    .from("users")
    .insert({
      name: parsed.data.name,
      email,
      password_hash,
    })
    .select("id, email")
    .single()

  if (error || !user) {
    console.error("signup insert failed", error)
    return fail("INTERNAL", "Could not create account")
  }

  try {
    await ensureDefaultBoard(user.id)
  } catch (boardError) {
    console.error("ensureDefaultBoard failed", boardError)
  }

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return fail("INTERNAL", "Account created but sign-in failed")
    }
    throw error
  }

  return ok({ email })
}

export async function loginAction(
  input: z.infer<typeof loginSchema>
): Promise<ActionResult<{ email: string }>> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) {
    return fail("VALIDATION", "Invalid login data")
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return fail("UNAUTHORIZED", "INVALID_CREDENTIALS")
    }
    throw error
  }

  const supabase = getNextAuthAdmin()
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", parsed.data.email.toLowerCase())
    .maybeSingle()

  if (user) {
    try {
      await ensureDefaultBoard(user.id)
    } catch (boardError) {
      console.error("ensureDefaultBoard failed", boardError)
    }
  }

  return ok({ email: parsed.data.email })
}
