import {
  canArchiveFromLane,
  midpoint,
  needsRebalance,
  POSITION_GAP,
} from "@/features/kanban/domain/rules"
import type { Card, LaneKey, Tag } from "@/features/kanban/domain/types"
import { isLaneKey } from "@/features/kanban/domain/types"
import { recordActivity } from "@/features/kanban/data/activity-repository"
import { getAppAdmin } from "@/lib/supabase/admin"

type CardRow = {
  id: string
  board_id: string
  lane_id: string
  user_id: string
  title: string
  description: string | null
  due_at: string | null
  position: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

async function getLaneByKey(boardId: string, key: LaneKey) {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("lanes")
    .select("*")
    .eq("board_id", boardId)
    .eq("key", key)
    .single()

  if (error || !data) {
    throw new Error(`Lane not found: ${key}`)
  }
  return data
}

async function getLaneKey(laneId: string): Promise<LaneKey> {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("lanes")
    .select("key")
    .eq("id", laneId)
    .single()

  if (error || !data || !isLaneKey(data.key)) {
    throw new Error("Invalid lane")
  }
  return data.key
}

async function loadCardTags(cardId: string): Promise<Tag[]> {
  const db = getAppAdmin()
  const { data: links } = await db
    .from("card_tags")
    .select("tag_id")
    .eq("card_id", cardId)

  if (!links?.length) {
    return []
  }

  const tagIds = links.map((link) => link.tag_id)
  const { data: tags } = await db.from("tags").select("*").in("id", tagIds)

  return (
    tags?.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })) ?? []
  )
}

async function toCard(row: CardRow, laneKey?: LaneKey): Promise<Card> {
  const key = laneKey ?? (await getLaneKey(row.lane_id))
  const tags = await loadCardTags(row.id)
  return {
    id: row.id,
    boardId: row.board_id,
    laneId: row.lane_id,
    laneKey: key,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    position: Number(row.position),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
  }
}

async function ensureTags(userId: string, names: string[]): Promise<Tag[]> {
  const db = getAppAdmin()
  const cleaned = [
    ...new Set(
      names
        .map((n) => n.trim())
        .filter((n) => n.length > 0 && n.length <= 40)
    ),
  ]

  if (cleaned.length === 0) {
    return []
  }

  const tags: Tag[] = []

  for (const name of cleaned) {
    const { data: existing } = await db
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .ilike("name", name)
      .maybeSingle()

    if (existing) {
      tags.push({
        id: existing.id,
        name: existing.name,
        color: existing.color,
      })
      continue
    }

    const { data: created, error } = await db
      .from("tags")
      .insert({ user_id: userId, name })
      .select("*")
      .single()

    if (error || !created) {
      throw new Error(`Failed to create tag: ${error?.message}`)
    }

    tags.push({
      id: created.id,
      name: created.name,
      color: created.color,
    })
  }

  return tags
}

async function syncCardTags(cardId: string, tags: Tag[]) {
  const db = getAppAdmin()
  await db.from("card_tags").delete().eq("card_id", cardId)
  if (tags.length === 0) {
    return
  }
  const { error } = await db.from("card_tags").insert(
    tags.map((tag) => ({
      card_id: cardId,
      tag_id: tag.id,
    }))
  )
  if (error) {
    throw new Error(`Failed to sync tags: ${error.message}`)
  }
}

async function nextPosition(laneId: string): Promise<number> {
  const db = getAppAdmin()
  const { data } = await db
    .from("cards")
    .select("position")
    .eq("lane_id", laneId)
    .is("archived_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    return POSITION_GAP
  }
  return Number(data.position) + POSITION_GAP
}

async function rebalanceLane(laneId: string) {
  const db = getAppAdmin()
  const { data: cards } = await db
    .from("cards")
    .select("id")
    .eq("lane_id", laneId)
    .is("archived_at", null)
    .order("position", { ascending: true })

  if (!cards) {
    return
  }

  let position = POSITION_GAP
  for (const card of cards) {
    await db
      .from("cards")
      .update({ position, updated_at: new Date().toISOString() })
      .eq("id", card.id)
    position += POSITION_GAP
  }
}

export async function createCard(input: {
  userId: string
  boardId: string
  title: string
  description?: string | null
  dueAt?: string | null
  laneKey?: LaneKey
  tagNames?: string[]
}): Promise<Card> {
  const db = getAppAdmin()
  const lane = await getLaneByKey(input.boardId, input.laneKey ?? "todo")
  const position = await nextPosition(lane.id)
  const tags = await ensureTags(input.userId, input.tagNames ?? [])

  const { data, error } = await db
    .from("cards")
    .insert({
      board_id: input.boardId,
      lane_id: lane.id,
      user_id: input.userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      due_at: input.dueAt ?? null,
      position,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to create card: ${error?.message}`)
  }

  await syncCardTags(data.id, tags)
  await recordActivity({
    userId: input.userId,
    boardId: input.boardId,
    entityType: "card",
    entityId: data.id,
    action: "created",
    payload: { laneKey: lane.key },
  })

  return toCard(data, lane.key as LaneKey)
}

export async function updateCard(input: {
  userId: string
  cardId: string
  title?: string
  description?: string | null
  dueAt?: string | null
  laneKey?: LaneKey
  tagNames?: string[]
}): Promise<Card> {
  const db = getAppAdmin()
  const { data: existing, error } = await db
    .from("cards")
    .select("*")
    .eq("id", input.cardId)
    .eq("user_id", input.userId)
    .single()

  if (error || !existing) {
    throw new Error("NOT_FOUND")
  }

  const fromLaneKey = await getLaneKey(existing.lane_id)
  let laneId = existing.lane_id
  let toLaneKey = fromLaneKey
  let position = Number(existing.position)

  if (input.laneKey && input.laneKey !== fromLaneKey) {
    const lane = await getLaneByKey(existing.board_id, input.laneKey)
    laneId = lane.id
    toLaneKey = input.laneKey
    position = await nextPosition(lane.id)
  }

  const { data, error: updateError } = await db
    .from("cards")
    .update({
      title: input.title?.trim() ?? existing.title,
      description:
        input.description === undefined
          ? existing.description
          : input.description?.trim() || null,
      due_at: input.dueAt === undefined ? existing.due_at : input.dueAt,
      lane_id: laneId,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.cardId)
    .select("*")
    .single()

  if (updateError || !data) {
    throw new Error(`Failed to update card: ${updateError?.message}`)
  }

  if (input.tagNames) {
    const tags = await ensureTags(input.userId, input.tagNames)
    await syncCardTags(data.id, tags)
  }

  await recordActivity({
    userId: input.userId,
    boardId: existing.board_id,
    entityType: "card",
    entityId: data.id,
    action: fromLaneKey !== toLaneKey ? "moved" : "updated",
    payload:
      fromLaneKey !== toLaneKey
        ? { fromLaneKey, toLaneKey }
        : { fields: ["title", "description", "dueAt", "tags"] },
  })

  return toCard(data, toLaneKey)
}

export async function moveCard(input: {
  userId: string
  cardId: string
  toLaneKey: LaneKey
  beforeCardId?: string | null
  afterCardId?: string | null
}): Promise<Card> {
  const db = getAppAdmin()
  const { data: existing, error } = await db
    .from("cards")
    .select("*")
    .eq("id", input.cardId)
    .eq("user_id", input.userId)
    .is("archived_at", null)
    .single()

  if (error || !existing) {
    throw new Error("NOT_FOUND")
  }

  const fromLaneKey = await getLaneKey(existing.lane_id)
  const toLane = await getLaneByKey(existing.board_id, input.toLaneKey)

  let beforePos: number | null = null
  let afterPos: number | null = null

  if (input.beforeCardId) {
    const { data: before } = await db
      .from("cards")
      .select("position")
      .eq("id", input.beforeCardId)
      .maybeSingle()
    beforePos = before ? Number(before.position) : null
  }

  if (input.afterCardId) {
    const { data: after } = await db
      .from("cards")
      .select("position")
      .eq("id", input.afterCardId)
      .maybeSingle()
    afterPos = after ? Number(after.position) : null
  }

  if (needsRebalance(beforePos, afterPos)) {
    await rebalanceLane(toLane.id)
    beforePos = null
    afterPos = null
    if (input.beforeCardId) {
      const { data: before } = await db
        .from("cards")
        .select("position")
        .eq("id", input.beforeCardId)
        .maybeSingle()
      beforePos = before ? Number(before.position) : null
    }
    if (input.afterCardId) {
      const { data: after } = await db
        .from("cards")
        .select("position")
        .eq("id", input.afterCardId)
        .maybeSingle()
      afterPos = after ? Number(after.position) : null
    }
  }

  const position = midpoint(beforePos, afterPos)

  const { data, error: updateError } = await db
    .from("cards")
    .update({
      lane_id: toLane.id,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.cardId)
    .select("*")
    .single()

  if (updateError || !data) {
    throw new Error(`Failed to move card: ${updateError?.message}`)
  }

  if (fromLaneKey !== input.toLaneKey) {
    await recordActivity({
      userId: input.userId,
      boardId: existing.board_id,
      entityType: "card",
      entityId: data.id,
      action: "moved",
      payload: { fromLaneKey, toLaneKey: input.toLaneKey },
    })
  }

  return toCard(data, input.toLaneKey)
}

export async function archiveCard(input: {
  userId: string
  cardId: string
}): Promise<Card> {
  const db = getAppAdmin()
  const { data: existing, error } = await db
    .from("cards")
    .select("*")
    .eq("id", input.cardId)
    .eq("user_id", input.userId)
    .is("archived_at", null)
    .single()

  if (error || !existing) {
    throw new Error("NOT_FOUND")
  }

  const laneKey = await getLaneKey(existing.lane_id)
  if (!canArchiveFromLane(laneKey)) {
    throw new Error("FORBIDDEN")
  }

  const archivedAt = new Date().toISOString()
  const { data, error: updateError } = await db
    .from("cards")
    .update({
      archived_at: archivedAt,
      updated_at: archivedAt,
    })
    .eq("id", input.cardId)
    .select("*")
    .single()

  if (updateError || !data) {
    throw new Error(`Failed to archive card: ${updateError?.message}`)
  }

  await recordActivity({
    userId: input.userId,
    boardId: existing.board_id,
    entityType: "card",
    entityId: data.id,
    action: "archived",
  })

  return toCard(data, laneKey)
}

export async function archiveDoneCards(input: {
  userId: string
  boardId: string
}): Promise<number> {
  const db = getAppAdmin()
  const doneLane = await getLaneByKey(input.boardId, "done")
  const { data: cards } = await db
    .from("cards")
    .select("id")
    .eq("board_id", input.boardId)
    .eq("lane_id", doneLane.id)
    .eq("user_id", input.userId)
    .is("archived_at", null)

  if (!cards?.length) {
    return 0
  }

  let count = 0
  for (const card of cards) {
    await archiveCard({ userId: input.userId, cardId: card.id })
    count += 1
  }
  return count
}

export async function restoreCard(input: {
  userId: string
  cardId: string
}): Promise<Card> {
  const db = getAppAdmin()
  const { data: existing, error } = await db
    .from("cards")
    .select("*")
    .eq("id", input.cardId)
    .eq("user_id", input.userId)
    .not("archived_at", "is", null)
    .single()

  if (error || !existing) {
    throw new Error("NOT_FOUND")
  }

  const doneLane = await getLaneByKey(existing.board_id, "done")
  const position = await nextPosition(doneLane.id)
  const now = new Date().toISOString()

  const { data, error: updateError } = await db
    .from("cards")
    .update({
      archived_at: null,
      lane_id: doneLane.id,
      position,
      updated_at: now,
    })
    .eq("id", input.cardId)
    .select("*")
    .single()

  if (updateError || !data) {
    throw new Error(`Failed to restore card: ${updateError?.message}`)
  }

  await recordActivity({
    userId: input.userId,
    boardId: existing.board_id,
    entityType: "card",
    entityId: data.id,
    action: "restored",
  })

  return toCard(data, "done")
}

export async function deleteCard(input: {
  userId: string
  cardId: string
}): Promise<void> {
  const db = getAppAdmin()
  const { error } = await db
    .from("cards")
    .delete()
    .eq("id", input.cardId)
    .eq("user_id", input.userId)

  if (error) {
    throw new Error(`Failed to delete card: ${error.message}`)
  }
}
