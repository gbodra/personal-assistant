"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/session"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { eventBus } from "@/lib/events/bus"
import { LANE_KEYS, type Card } from "@/features/kanban/domain/types"
import * as cards from "@/features/kanban/data/card-repository"
import { getDailyFocusBoard } from "@/features/kanban/data/board-repository"

const laneKeySchema = z.enum(LANE_KEYS)

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  dueAt: z.string().optional().nullable(),
  laneKey: laneKeySchema.optional(),
  tagNames: z.array(z.string().max(40)).max(20).optional(),
})

const updateSchema = z.object({
  cardId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  dueAt: z.string().optional().nullable(),
  laneKey: laneKeySchema.optional(),
  tagNames: z.array(z.string().max(40)).max(20).optional(),
})

const moveSchema = z.object({
  cardId: z.string().uuid(),
  toLaneKey: laneKeySchema,
  beforeCardId: z.string().uuid().optional().nullable(),
  afterCardId: z.string().uuid().optional().nullable(),
})

function mapError(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : "INTERNAL"
  if (message === "UNAUTHORIZED") {
    return fail("UNAUTHORIZED", "Sign in required")
  }
  if (message === "NOT_FOUND") {
    return fail("NOT_FOUND", "Card not found")
  }
  if (message === "FORBIDDEN") {
    return fail("FORBIDDEN", "Only done cards can be archived")
  }
  console.error(error)
  return fail("INTERNAL", "Something went wrong")
}

export async function createCardAction(
  input: z.infer<typeof createSchema>
): Promise<ActionResult<Card>> {
  try {
    const user = await requireUser()
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid card data")
    }

    const board = await getDailyFocusBoard(user.id)
    const card = await cards.createCard({
      userId: user.id,
      boardId: board.id,
      ...parsed.data,
    })

    await eventBus.emit({
      type: "kanban.card.created",
      userId: user.id,
      cardId: card.id,
      boardId: board.id,
    })

    revalidatePath("/focus")
    return ok(card)
  } catch (error) {
    return mapError(error)
  }
}

export async function updateCardAction(
  input: z.infer<typeof updateSchema>
): Promise<ActionResult<Card>> {
  try {
    const user = await requireUser()
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid card data")
    }

    const card = await cards.updateCard({
      userId: user.id,
      ...parsed.data,
    })

    await eventBus.emit({
      type: "kanban.card.updated",
      userId: user.id,
      cardId: card.id,
      boardId: card.boardId,
    })

    revalidatePath("/focus")
    revalidatePath("/focus/archive")
    return ok(card)
  } catch (error) {
    return mapError(error)
  }
}

export async function moveCardAction(
  input: z.infer<typeof moveSchema>
): Promise<ActionResult<Card>> {
  try {
    const user = await requireUser()
    const parsed = moveSchema.safeParse(input)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid move")
    }

    const existingBoard = await getDailyFocusBoard(user.id)
    const previous = existingBoard.lanes
      .flatMap((l) => l.cards)
      .find((c) => c.id === parsed.data.cardId)

    const card = await cards.moveCard({
      userId: user.id,
      ...parsed.data,
    })

    if (previous && previous.laneKey !== card.laneKey) {
      await eventBus.emit({
        type: "kanban.card.moved",
        userId: user.id,
        cardId: card.id,
        boardId: card.boardId,
        fromLaneKey: previous.laneKey,
        toLaneKey: card.laneKey,
      })
    }

    revalidatePath("/focus")
    return ok(card)
  } catch (error) {
    return mapError(error)
  }
}

export async function archiveCardAction(
  cardId: string
): Promise<ActionResult<Card>> {
  try {
    const user = await requireUser()
    const parsed = z.string().uuid().safeParse(cardId)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid card id")
    }

    const card = await cards.archiveCard({
      userId: user.id,
      cardId: parsed.data,
    })

    await eventBus.emit({
      type: "kanban.card.archived",
      userId: user.id,
      cardId: card.id,
      boardId: card.boardId,
    })

    revalidatePath("/focus")
    revalidatePath("/focus/archive")
    return ok(card)
  } catch (error) {
    return mapError(error)
  }
}

export async function archiveDoneCardsAction(): Promise<
  ActionResult<{ count: number }>
> {
  try {
    const user = await requireUser()
    const board = await getDailyFocusBoard(user.id)
    const count = await cards.archiveDoneCards({
      userId: user.id,
      boardId: board.id,
    })
    revalidatePath("/focus")
    revalidatePath("/focus/archive")
    return ok({ count })
  } catch (error) {
    return mapError(error)
  }
}

export async function restoreCardAction(
  cardId: string
): Promise<ActionResult<Card>> {
  try {
    const user = await requireUser()
    const parsed = z.string().uuid().safeParse(cardId)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid card id")
    }

    const card = await cards.restoreCard({
      userId: user.id,
      cardId: parsed.data,
    })

    await eventBus.emit({
      type: "kanban.card.restored",
      userId: user.id,
      cardId: card.id,
      boardId: card.boardId,
    })

    revalidatePath("/focus")
    revalidatePath("/focus/archive")
    return ok(card)
  } catch (error) {
    return mapError(error)
  }
}

export async function deleteCardAction(
  cardId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser()
    const parsed = z.string().uuid().safeParse(cardId)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid card id")
    }

    await cards.deleteCard({ userId: user.id, cardId: parsed.data })
    revalidatePath("/focus")
    revalidatePath("/focus/archive")
    return ok({ id: parsed.data })
  } catch (error) {
    return mapError(error)
  }
}
