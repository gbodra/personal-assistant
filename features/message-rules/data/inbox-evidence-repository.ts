import { listImportantContacts } from "@/features/contacts/data/contacts-repository"
import { listWhatsappGroups } from "@/features/message-rules/data/rules-repository"
import {
  INBOX_EVIDENCE_LIMIT,
  TEXT_TRUNCATE,
  TITLE_TRUNCATE,
  type InboxEvidenceItem,
  truncateText,
} from "@/features/message-rules/domain/insights"
import { normalizePhone } from "@/features/message-rules/domain/phone"
import { getAppAdmin } from "@/lib/supabase/admin"

type CardEvidenceRow = {
  id: string
  title: string
  description: string | null
  created_at: string
  source_message_id: string | null
}

type MessageRow = {
  id: string
  from: string | null
  message: string | null
  message_type: string | null
  is_group: boolean
  group_id: string | null
  participant: string | null
  was_mentioned: boolean
}

async function resolveInboxLane(userId: string): Promise<{
  boardId: string
  laneId: string
} | null> {
  const db = getAppAdmin()

  const { data: board } = await db
    .from("boards")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", "daily-focus")
    .maybeSingle()

  if (!board) return null

  const { data: lane } = await db
    .from("lanes")
    .select("id")
    .eq("board_id", board.id)
    .eq("key", "inbox")
    .maybeSingle()

  if (!lane) return null

  return { boardId: board.id, laneId: lane.id }
}

export async function countInboxCards(userId: string): Promise<number> {
  const lane = await resolveInboxLane(userId)
  if (!lane) return 0

  const db = getAppAdmin()
  const { count, error } = await db
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("board_id", lane.boardId)
    .eq("lane_id", lane.laneId)
    .eq("user_id", userId)
    .is("archived_at", null)

  if (error) {
    throw new Error(`Failed to count inbox cards: ${error.message}`)
  }

  return count ?? 0
}

export async function listInboxEvidence(
  userId: string,
  options?: { limit?: number }
): Promise<{ items: InboxEvidenceItem[]; totalCount: number; truncated: boolean }> {
  const limit = options?.limit ?? INBOX_EVIDENCE_LIMIT
  const lane = await resolveInboxLane(userId)
  if (!lane) {
    return { items: [], totalCount: 0, truncated: false }
  }

  const db = getAppAdmin()
  const totalCount = await countInboxCards(userId)
  if (totalCount === 0) {
    return { items: [], totalCount: 0, truncated: false }
  }

  const { data: cards, error: cardsError } = await db
    .from("cards")
    .select("id, title, description, created_at, source_message_id")
    .eq("board_id", lane.boardId)
    .eq("lane_id", lane.laneId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cardsError) {
    throw new Error(`Failed to list inbox cards: ${cardsError.message}`)
  }

  const cardRows = (cards ?? []) as CardEvidenceRow[]
  const messageIds = cardRows
    .map((card) => card.source_message_id)
    .filter((id): id is string => Boolean(id))

  const messagesById = new Map<string, MessageRow>()
  if (messageIds.length > 0) {
    const { data: messages, error: messagesError } = await db
      .from("messages_received")
      .select(
        "id, from, message, message_type, is_group, group_id, participant, was_mentioned"
      )
      .eq("user_id", userId)
      .in("id", messageIds)

    if (messagesError) {
      throw new Error(`Failed to load inbox messages: ${messagesError.message}`)
    }

    for (const row of (messages ?? []) as MessageRow[]) {
      messagesById.set(row.id, row)
    }
  }

  const [contacts, groups] = await Promise.all([
    listImportantContacts(userId),
    listWhatsappGroups(userId),
  ])

  const contactByPhone = new Map(
    contacts.map((contact) => [normalizePhone(contact.phone), contact])
  )
  const groupByExternalId = new Map(
    groups.map((group) => [group.externalGroupId, group])
  )

  const items: InboxEvidenceItem[] = cardRows.map((card) => {
    const message = card.source_message_id
      ? messagesById.get(card.source_message_id)
      : undefined

    const phoneRaw = message?.participant ?? message?.from ?? null
    const phone = phoneRaw ? normalizePhone(phoneRaw) : ""
    const contact = phone ? contactByPhone.get(phone) : undefined
    const group = message?.group_id
      ? groupByExternalId.get(message.group_id)
      : undefined

    return {
      cardId: card.id,
      title: truncateText(card.title, TITLE_TRUNCATE),
      description: card.description
        ? truncateText(card.description, TEXT_TRUNCATE)
        : null,
      createdAt: card.created_at,
      contactName: contact?.name ?? null,
      contactGroup: contact?.contactGroup ?? null,
      groupName: group?.name ?? null,
      from: message?.from ?? null,
      participant: message?.participant ?? null,
      isGroup: message?.is_group ?? null,
      groupId: message?.group_id ?? null,
      wasMentioned: message?.was_mentioned ?? null,
      messageType: message?.message_type ?? null,
      message: message?.message
        ? truncateText(message.message, TEXT_TRUNCATE)
        : null,
    }
  })

  return {
    items,
    totalCount,
    truncated: totalCount > items.length,
  }
}
