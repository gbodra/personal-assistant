export type DomainEvent =
  | {
      type: "kanban.card.created"
      userId: string
      cardId: string
      boardId: string
    }
  | {
      type: "kanban.card.updated"
      userId: string
      cardId: string
      boardId: string
    }
  | {
      type: "kanban.card.moved"
      userId: string
      cardId: string
      boardId: string
      fromLaneKey: string
      toLaneKey: string
    }
  | {
      type: "kanban.card.archived"
      userId: string
      cardId: string
      boardId: string
    }
  | {
      type: "kanban.card.restored"
      userId: string
      cardId: string
      boardId: string
    }

type Listener = (event: DomainEvent) => void | Promise<void>

const listeners = new Set<Listener>()

export const eventBus = {
  on(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  async emit(event: DomainEvent) {
    await Promise.all(
      [...listeners].map(async (listener) => {
        try {
          await listener(event)
        } catch (error) {
          console.error("Domain event listener failed", event.type, error)
        }
      })
    )
  },
}
