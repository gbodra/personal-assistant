import { getAppAdmin } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"

export async function recordActivity(input: {
  userId: string
  boardId?: string | null
  entityType: string
  entityId: string
  action: string
  payload?: Record<string, unknown>
}) {
  const db = getAppAdmin()
  const { error } = await db.from("activity_events").insert({
    user_id: input.userId,
    board_id: input.boardId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    payload: ({ v: 1, ...(input.payload ?? {}) } as Json),
  })

  if (error) {
    console.error("recordActivity failed", error)
  }
}
