"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { listImportantContacts } from "@/features/contacts/data/contacts-repository"
import { CONTACT_GROUPS } from "@/features/contacts/domain/types"
import {
  createMessageRule,
  deleteMessageRule,
  listMessageRules,
  listWhatsappGroups,
  setMessageRuleEnabled,
  updateMessageRule,
} from "@/features/message-rules/data/rules-repository"
import { ruleCompiler } from "@/features/message-rules/domain/compiler"
import { saveRuleSchema } from "@/features/message-rules/domain/schema"
import type {
  ContactList,
  MessageRule,
  MessageRuleDraft,
} from "@/features/message-rules/domain/types"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { requireUser } from "@/lib/auth/session"
import {
  checkRateLimit,
  COMPILE_RATE_LIMIT,
} from "@/lib/security/rate-limit"

function mapError(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "INTERNAL"
  if (message === "UNAUTHORIZED") {
    return fail("UNAUTHORIZED", "Sign in required")
  }
  if (message === "NOT_FOUND") {
    return fail("NOT_FOUND", "Rule not found")
  }
  if (message === "CATCH_ALL_EXISTS") {
    return fail("VALIDATION", "Only one catch-all rule is allowed")
  }
  if (message === "EMPTY_UTTERANCE") {
    return fail("VALIDATION", "Describe the rule first")
  }
  console.error(error)
  return fail("INTERNAL", "Something went wrong")
}

export async function compileRuleAction(
  utterance: string
): Promise<ActionResult<MessageRuleDraft>> {
  try {
    const user = await requireUser()
    const rate = checkRateLimit(
      `compile:${user.id}`,
      COMPILE_RATE_LIMIT.limit,
      COMPILE_RATE_LIMIT.windowMs
    )
    if (!rate.allowed) {
      return fail("FORBIDDEN", "RATE_LIMITED")
    }

    const parsed = z.string().trim().min(1).max(4000).safeParse(utterance)
    if (!parsed.success) {
      return fail("VALIDATION", "Describe the rule first")
    }

    const [contacts, groups] = await Promise.all([
      listImportantContacts(user.id),
      listWhatsappGroups(user.id),
    ])

    const contactsByGroup = Object.fromEntries(
      CONTACT_GROUPS.map((group) => [group, [] as string[]])
    ) as Record<ContactList, string[]>

    for (const contact of contacts) {
      contactsByGroup[contact.contactGroup].push(contact.name)
    }

    const draft = await ruleCompiler.compile(parsed.data, {
      contactsByGroup,
      groupNames: groups.map((g) => ({
        name: g.name,
        externalGroupId: g.externalGroupId,
      })),
    })

    return ok(draft)
  } catch (error) {
    return mapError(error)
  }
}

export async function createRuleAction(
  input: z.infer<typeof saveRuleSchema>
): Promise<ActionResult<MessageRule>> {
  try {
    const user = await requireUser()
    const parsed = saveRuleSchema.safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid rule data")
    }

    const rule = await createMessageRule({
      userId: user.id,
      ...parsed.data,
    })
    revalidatePath("/rules")
    return ok(rule)
  } catch (error) {
    return mapError(error)
  }
}

export async function updateRuleAction(
  input: z.infer<typeof saveRuleSchema> & { id: string }
): Promise<ActionResult<MessageRule>> {
  try {
    const user = await requireUser()
    const parsed = saveRuleSchema
      .extend({ id: z.string().uuid() })
      .safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid rule data")
    }

    const { id, ...rest } = parsed.data
    const rule = await updateMessageRule({
      userId: user.id,
      id,
      ...rest,
    })
    revalidatePath("/rules")
    return ok(rule)
  } catch (error) {
    return mapError(error)
  }
}

export async function setRuleEnabledAction(input: {
  id: string
  enabled: boolean
}): Promise<ActionResult<MessageRule>> {
  try {
    const user = await requireUser()
    const parsed = z
      .object({
        id: z.string().uuid(),
        enabled: z.boolean(),
      })
      .safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid rule id")
    }

    const rule = await setMessageRuleEnabled({
      userId: user.id,
      ...parsed.data,
    })
    revalidatePath("/rules")
    return ok(rule)
  } catch (error) {
    return mapError(error)
  }
}

export async function deleteRuleAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser()
    const parsed = z.string().uuid().safeParse(id)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid rule id")
    }

    await deleteMessageRule({ userId: user.id, id: parsed.data })
    revalidatePath("/rules")
    return ok({ id: parsed.data })
  } catch (error) {
    return mapError(error)
  }
}

export async function listRulesAction(): Promise<ActionResult<MessageRule[]>> {
  try {
    const user = await requireUser()
    const rules = await listMessageRules(user.id)
    return ok(rules)
  } catch (error) {
    return mapError(error)
  }
}
