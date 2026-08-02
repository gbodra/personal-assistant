"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import * as contacts from "@/features/contacts/data/contacts-repository"
import {
  CONTACT_GROUPS,
  type ImportantContact,
} from "@/features/contacts/domain/types"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { requireUser } from "@/lib/auth/session"

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  contactGroup: z.enum(CONTACT_GROUPS),
})

function mapError(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "INTERNAL"
  if (message === "UNAUTHORIZED") {
    return fail("UNAUTHORIZED", "Sign in required")
  }
  if (message === "NOT_FOUND") {
    return fail("NOT_FOUND", "Contact not found")
  }
  if (message === "DUPLICATE_PHONE") {
    return fail("CONFLICT", "Phone already registered")
  }
  console.error(error)
  return fail("INTERNAL", "Something went wrong")
}

export async function createContactAction(
  input: z.infer<typeof contactSchema>
): Promise<ActionResult<ImportantContact>> {
  try {
    const user = await requireUser()
    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid contact data")
    }

    const contact = await contacts.createImportantContact({
      userId: user.id,
      ...parsed.data,
    })
    revalidatePath("/contacts")
    revalidatePath("/rules")
    return ok(contact)
  } catch (error) {
    return mapError(error)
  }
}

export async function updateContactAction(
  input: z.infer<typeof contactSchema> & { id: string }
): Promise<ActionResult<ImportantContact>> {
  try {
    const user = await requireUser()
    const parsed = contactSchema
      .extend({ id: z.string().uuid() })
      .safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid contact data")
    }

    const contact = await contacts.updateImportantContact({
      userId: user.id,
      ...parsed.data,
    })
    revalidatePath("/contacts")
    revalidatePath("/rules")
    return ok(contact)
  } catch (error) {
    return mapError(error)
  }
}

export async function deleteContactAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser()
    const parsed = z.string().uuid().safeParse(id)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid contact id")
    }

    await contacts.deleteImportantContact({
      userId: user.id,
      id: parsed.data,
    })
    revalidatePath("/contacts")
    revalidatePath("/rules")
    return ok({ id: parsed.data })
  } catch (error) {
    return mapError(error)
  }
}
