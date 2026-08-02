export const LANE_KEYS = ["todo", "doing", "done", "canceled"] as const

export type LaneKey = (typeof LANE_KEYS)[number]

export const CARD_PRIORITIES = ["critical", "high", "normal", "low"] as const
export type CardPriority = (typeof CARD_PRIORITIES)[number]

export type Tag = {
  id: string
  name: string
  color: string | null
}

export type Card = {
  id: string
  boardId: string
  laneId: string
  laneKey: LaneKey
  userId: string
  title: string
  description: string | null
  dueAt: string | null
  position: number
  priority: CardPriority
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  tags: Tag[]
}

export function isCardPriority(value: string): value is CardPriority {
  return (CARD_PRIORITIES as readonly string[]).includes(value)
}

export type Lane = {
  id: string
  boardId: string
  key: LaneKey
  name: string
  position: number
  cards: Card[]
}

export type Board = {
  id: string
  userId: string
  name: string
  slug: string
  createdAt: string
  lanes: Lane[]
}

export function isLaneKey(value: string): value is LaneKey {
  return (LANE_KEYS as readonly string[]).includes(value)
}
