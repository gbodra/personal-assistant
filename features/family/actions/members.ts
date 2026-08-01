"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import * as family from "@/features/family/data/family-repository"
import type { FamilyMember } from "@/features/family/domain/types"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { requireUser } from "@/lib/auth/session"

const memberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
})

function mapError(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "INTERNAL"
  if (message === "UNAUTHORIZED") {
    return fail("UNAUTHORIZED", "Sign in required")
  }
  if (message === "NOT_FOUND") {
    return fail("NOT_FOUND", "Member not found")
  }
  console.error(error)
  return fail("INTERNAL", "Something went wrong")
}

export async function createFamilyMemberAction(
  input: z.infer<typeof memberSchema>
): Promise<ActionResult<FamilyMember>> {
  try {
    const user = await requireUser()
    const parsed = memberSchema.safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid member data")
    }

    const member = await family.createFamilyMember({
      userId: user.id,
      ...parsed.data,
    })
    revalidatePath("/family")
    return ok(member)
  } catch (error) {
    return mapError(error)
  }
}

export async function updateFamilyMemberAction(
  input: z.infer<typeof memberSchema> & { id: string }
): Promise<ActionResult<FamilyMember>> {
  try {
    const user = await requireUser()
    const parsed = memberSchema
      .extend({ id: z.string().uuid() })
      .safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid member data")
    }

    const member = await family.updateFamilyMember({
      userId: user.id,
      ...parsed.data,
    })
    revalidatePath("/family")
    return ok(member)
  } catch (error) {
    return mapError(error)
  }
}

export async function deleteFamilyMemberAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser()
    const parsed = z.string().uuid().safeParse(id)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid member id")
    }

    await family.deleteFamilyMember({ userId: user.id, id: parsed.data })
    revalidatePath("/family")
    return ok({ id: parsed.data })
  } catch (error) {
    return mapError(error)
  }
}
