import { SCHEMA_VERSION } from "@/features/message-rules/domain/schema"
import type {
  MessageRule,
  RuleActions,
  RuleCondition,
} from "@/features/message-rules/domain/types"
import { getAppAdmin } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"

type RuleRow = {
  id: string
  user_id: string
  name: string
  enabled: boolean
  position: number
  schema_version: number
  conditions: Json
  actions: Json
  is_catch_all: boolean
  source_utterance: string | null
  created_at: string
  updated_at: string
}

function mapRule(row: RuleRow): MessageRule {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    enabled: row.enabled,
    position: row.position,
    schemaVersion: row.schema_version,
    conditions: row.conditions as RuleCondition[],
    actions: row.actions as RuleActions,
    isCatchAll: row.is_catch_all,
    sourceUtterance: row.source_utterance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function attachTagNames(rules: MessageRule[]): Promise<MessageRule[]> {
  const tagIds = [
    ...new Set(
      rules.flatMap((rule) =>
        rule.actions.disposition === "create" ? rule.actions.tag_ids : []
      )
    ),
  ]
  if (tagIds.length === 0) {
    return rules
  }

  const db = getAppAdmin()
  const { data: tags } = await db.from("tags").select("id, name").in("id", tagIds)
  const byId = new Map((tags ?? []).map((tag) => [tag.id, tag.name]))

  return rules.map((rule) => {
    if (rule.actions.disposition !== "create") {
      return rule
    }
    return {
      ...rule,
      actions: {
        ...rule.actions,
        tag_names: rule.actions.tag_ids
          .map((id) => byId.get(id))
          .filter((name): name is string => Boolean(name)),
      },
    }
  })
}

export async function listMessageRules(userId: string): Promise<MessageRule[]> {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("message_rules")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true })

  if (error) {
    throw new Error(`Failed to list message rules: ${error.message}`)
  }

  return attachTagNames((data ?? []).map((row) => mapRule(row as RuleRow)))
}

async function nextPositionAboveCatchAll(userId: string): Promise<number> {
  const db = getAppAdmin()
  const { data: catchAll } = await db
    .from("message_rules")
    .select("position")
    .eq("user_id", userId)
    .eq("is_catch_all", true)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (catchAll) {
    const insertAt = Number(catchAll.position)
    const { data: toShift } = await db
      .from("message_rules")
      .select("id, position")
      .eq("user_id", userId)
      .gte("position", insertAt)
      .order("position", { ascending: false })

    for (const row of toShift ?? []) {
      await db
        .from("message_rules")
        .update({
          position: Number(row.position) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", userId)
    }
    return insertAt
  }

  const { data: last } = await db
    .from("message_rules")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  return last ? Number(last.position) + 1 : 0
}

async function ensureSingleCatchAll(userId: string, excludeId?: string) {
  const db = getAppAdmin()
  let query = db
    .from("message_rules")
    .select("id")
    .eq("user_id", userId)
    .eq("is_catch_all", true)
    .eq("enabled", true)

  if (excludeId) {
    query = query.neq("id", excludeId)
  }

  const { data } = await query
  if (data && data.length > 0) {
    throw new Error("CATCH_ALL_EXISTS")
  }
}

async function resolveTagIds(
  userId: string,
  tagIds: string[],
  tagNames: string[]
): Promise<string[]> {
  const db = getAppAdmin()
  const resolved = new Set<string>(tagIds)

  for (const name of tagNames) {
    const cleaned = name.trim()
    if (!cleaned) continue

    const { data: existing } = await db
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", cleaned)
      .maybeSingle()

    if (existing) {
      resolved.add(existing.id)
      continue
    }

    const { data: created, error } = await db
      .from("tags")
      .insert({ user_id: userId, name: cleaned })
      .select("id")
      .single()

    if (error || !created) {
      throw new Error(`Failed to create tag: ${error?.message}`)
    }
    resolved.add(created.id)
  }

  return [...resolved]
}

function buildPersistedActions(
  actions: RuleActions,
  tagIds: string[]
): RuleActions {
  if (actions.disposition === "ignore") {
    return { disposition: "ignore" }
  }
  return {
    disposition: "create",
    priority: actions.priority,
    tag_ids: tagIds,
    lane_key: actions.lane_key ?? "todo",
  }
}

export async function createMessageRule(input: {
  userId: string
  name: string
  enabled?: boolean
  conditions: RuleCondition[]
  actions: RuleActions
  isCatchAll?: boolean
  sourceUtterance?: string | null
  tagNames?: string[]
}): Promise<MessageRule> {
  const db = getAppAdmin()
  const isCatchAll = input.isCatchAll ?? false

  if (isCatchAll) {
    await ensureSingleCatchAll(input.userId)
  }

  const tagNames =
    input.tagNames ??
    (input.actions.disposition === "create"
      ? (input.actions.tag_names ?? [])
      : [])
  const existingTagIds =
    input.actions.disposition === "create" ? input.actions.tag_ids : []
  const tagIds = await resolveTagIds(input.userId, existingTagIds, tagNames)
  const actions = buildPersistedActions(input.actions, tagIds)
  const position = await nextPositionAboveCatchAll(input.userId)

  const { data, error } = await db
    .from("message_rules")
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      enabled: input.enabled ?? true,
      position,
      schema_version: SCHEMA_VERSION,
      conditions: (isCatchAll ? [] : input.conditions) as unknown as Json,
      actions: actions as unknown as Json,
      is_catch_all: isCatchAll,
      source_utterance: input.sourceUtterance?.trim() || null,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to create message rule: ${error?.message}`)
  }

  const [rule] = await attachTagNames([mapRule(data as RuleRow)])
  return rule
}

export async function updateMessageRule(input: {
  userId: string
  id: string
  name?: string
  enabled?: boolean
  conditions?: RuleCondition[]
  actions?: RuleActions
  isCatchAll?: boolean
  sourceUtterance?: string | null
  tagNames?: string[]
}): Promise<MessageRule> {
  const db = getAppAdmin()
  const { data: existing, error: loadError } = await db
    .from("message_rules")
    .select("*")
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .single()

  if (loadError || !existing) {
    throw new Error("NOT_FOUND")
  }

  const isCatchAll = input.isCatchAll ?? existing.is_catch_all
  if (isCatchAll) {
    await ensureSingleCatchAll(input.userId, input.id)
  }

  const nextActions = (input.actions ?? existing.actions) as RuleActions
  const tagNames =
    input.tagNames ??
    (nextActions.disposition === "create"
      ? (nextActions.tag_names ?? [])
      : [])
  const existingTagIds =
    nextActions.disposition === "create" ? nextActions.tag_ids : []
  const tagIds =
    input.actions || input.tagNames
      ? await resolveTagIds(input.userId, existingTagIds, tagNames)
      : existingTagIds
  const actions = buildPersistedActions(nextActions, tagIds)

  const { data, error } = await db
    .from("message_rules")
    .update({
      name: input.name?.trim() ?? existing.name,
      enabled: input.enabled ?? existing.enabled,
      conditions: (isCatchAll
        ? []
        : (input.conditions ?? existing.conditions)) as unknown as Json,
      actions: actions as unknown as Json,
      is_catch_all: isCatchAll,
      source_utterance:
        input.sourceUtterance !== undefined
          ? input.sourceUtterance?.trim() || null
          : existing.source_utterance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error ? `Failed to update: ${error.message}` : "NOT_FOUND")
  }

  const [rule] = await attachTagNames([mapRule(data as RuleRow)])
  return rule
}

export async function setMessageRuleEnabled(input: {
  userId: string
  id: string
  enabled: boolean
}): Promise<MessageRule> {
  return updateMessageRule({
    userId: input.userId,
    id: input.id,
    enabled: input.enabled,
  })
}

export async function deleteMessageRule(input: {
  userId: string
  id: string
}): Promise<void> {
  const db = getAppAdmin()
  const { error, count } = await db
    .from("message_rules")
    .delete({ count: "exact" })
    .eq("id", input.id)
    .eq("user_id", input.userId)

  if (error) {
    throw new Error(`Failed to delete message rule: ${error.message}`)
  }

  if (count === 0) {
    throw new Error("NOT_FOUND")
  }
}

export async function listWhatsappGroups(userId: string): Promise<
  { id: string; externalGroupId: string; name: string }[]
> {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("whatsapp_groups")
    .select("id, external_group_id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(`Failed to list groups: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    externalGroupId: row.external_group_id,
    name: row.name,
  }))
}
