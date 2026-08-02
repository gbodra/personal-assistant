import { DEFAULT_LANE_DEFS } from "@/features/kanban/domain/rules"
import type { Board, Card, Lane, LaneKey, Tag } from "@/features/kanban/domain/types"
import { isCardPriority, isLaneKey } from "@/features/kanban/domain/types"
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
  priority?: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

function mapTag(tag: { id: string; name: string; color: string | null }): Tag {
  return { id: tag.id, name: tag.name, color: tag.color }
}

function mapCard(row: CardRow, laneKey: LaneKey): Card {
  return {
    id: row.id,
    boardId: row.board_id,
    laneId: row.lane_id,
    laneKey,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    position: Number(row.position),
    priority:
      row.priority && isCardPriority(row.priority) ? row.priority : "normal",
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: [],
  }
}

export async function ensureDefaultBoard(userId: string): Promise<Board> {
  const db = getAppAdmin()

  const { data: existing } = await db
    .from("boards")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", "daily-focus")
    .maybeSingle()

  if (existing) {
    return getDailyFocusBoard(userId)
  }

  const { data: board, error } = await db
    .from("boards")
    .insert({
      user_id: userId,
      name: "Daily Focus",
      slug: "daily-focus",
    })
    .select("*")
    .single()

  if (error || !board) {
    throw new Error(`Failed to create board: ${error?.message}`)
  }

  const { error: lanesError } = await db.from("lanes").insert(
    DEFAULT_LANE_DEFS.map((lane) => ({
      board_id: board.id,
      key: lane.key,
      name: lane.name,
      position: lane.position,
    }))
  )

  if (lanesError) {
    throw new Error(`Failed to create lanes: ${lanesError.message}`)
  }

  return getDailyFocusBoard(userId)
}

export async function getDailyFocusBoard(userId: string): Promise<Board> {
  const db = getAppAdmin()

  const { data: board, error } = await db
    .from("boards")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", "daily-focus")
    .single()

  if (error || !board) {
    return ensureDefaultBoard(userId)
  }

  const { data: lanes, error: lanesError } = await db
    .from("lanes")
    .select("*")
    .eq("board_id", board.id)
    .order("position", { ascending: true })

  if (lanesError || !lanes) {
    throw new Error(`Failed to load lanes: ${lanesError?.message}`)
  }

  const { data: cards, error: cardsError } = await db
    .from("cards")
    .select("*")
    .eq("board_id", board.id)
    .is("archived_at", null)
    .order("position", { ascending: true })

  if (cardsError) {
    throw new Error(`Failed to load cards: ${cardsError.message}`)
  }

  const cardRows = (cards ?? []) as CardRow[]
  const cardIds = cardRows.map((card) => card.id)
  const tagsByCardId = new Map<string, Tag[]>()

  if (cardIds.length > 0) {
    const { data: links } = await db
      .from("card_tags")
      .select("card_id, tag_id")
      .in("card_id", cardIds)

    const tagIds = [...new Set((links ?? []).map((link) => link.tag_id))]
    const { data: tags } =
      tagIds.length > 0
        ? await db.from("tags").select("*").in("id", tagIds)
        : { data: [] as { id: string; name: string; color: string | null }[] }

    const tagById = new Map((tags ?? []).map((tag) => [tag.id, mapTag(tag)]))

    for (const link of links ?? []) {
      const tag = tagById.get(link.tag_id)
      if (!tag) continue
      const current = tagsByCardId.get(link.card_id) ?? []
      current.push(tag)
      tagsByCardId.set(link.card_id, current)
    }
  }

  const mappedLanes: Lane[] = lanes
    .filter((lane) => isLaneKey(lane.key))
    .map((lane) => {
      const key = lane.key as LaneKey
      const laneCards = cardRows
        .filter((card) => card.lane_id === lane.id)
        .map((card) => ({
          ...mapCard(card, key),
          tags: tagsByCardId.get(card.id) ?? [],
        }))

      return {
        id: lane.id,
        boardId: lane.board_id,
        key,
        name: lane.name,
        position: lane.position,
        cards: laneCards,
      }
    })

  return {
    id: board.id,
    userId: board.user_id,
    name: board.name,
    slug: board.slug,
    createdAt: board.created_at,
    lanes: mappedLanes,
  }
}

export async function getArchivedCards(userId: string): Promise<Card[]> {
  const db = getAppAdmin()

  const { data: board } = await db
    .from("boards")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", "daily-focus")
    .maybeSingle()

  if (!board) {
    return []
  }

  const { data: lanes } = await db
    .from("lanes")
    .select("id, key")
    .eq("board_id", board.id)

  const laneKeyById = new Map(
    (lanes ?? [])
      .filter((l) => isLaneKey(l.key))
      .map((l) => [l.id, l.key as LaneKey])
  )

  const { data: cards, error } = await db
    .from("cards")
    .select("*")
    .eq("board_id", board.id)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Failed to load archive: ${error.message}`)
  }

  const cardRows = (cards ?? []) as CardRow[]
  const cardIds = cardRows.map((card) => card.id)
  const tagsByCardId = new Map<string, Tag[]>()

  if (cardIds.length > 0) {
    const { data: links } = await db
      .from("card_tags")
      .select("card_id, tag_id")
      .in("card_id", cardIds)

    const tagIds = [...new Set((links ?? []).map((link) => link.tag_id))]
    const { data: tags } =
      tagIds.length > 0
        ? await db.from("tags").select("*").in("id", tagIds)
        : { data: [] as { id: string; name: string; color: string | null }[] }

    const tagById = new Map((tags ?? []).map((tag) => [tag.id, mapTag(tag)]))

    for (const link of links ?? []) {
      const tag = tagById.get(link.tag_id)
      if (!tag) continue
      const current = tagsByCardId.get(link.card_id) ?? []
      current.push(tag)
      tagsByCardId.set(link.card_id, current)
    }
  }

  return cardRows.map((card) => {
    const key = laneKeyById.get(card.lane_id) ?? "done"
    return {
      ...mapCard(card, key),
      tags: tagsByCardId.get(card.id) ?? [],
    }
  })
}
