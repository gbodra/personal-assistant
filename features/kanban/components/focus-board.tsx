"use client"

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { format, isBefore, parseISO, startOfDay } from "date-fns"
import {
  Archive,
  MoreHorizontal,
  Plus,
} from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import {
  archiveCardAction,
  archiveDoneCardsAction,
  createCardAction,
  deleteCardAction,
  moveCardAction,
  restoreCardAction,
  updateCardAction,
} from "@/features/kanban/actions/cards"
import type { Board, Card, Lane, LaneKey } from "@/features/kanban/domain/types"
import { LANE_KEYS } from "@/features/kanban/domain/types"
import type { Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardEditorSheet } from "@/features/kanban/components/card-editor-sheet"
import { useCardsRealtime } from "@/features/kanban/hooks/use-cards-realtime"
import { AppTopBar } from "@/components/shell/app-top-bar"
import Link from "next/link"

function cloneBoard(board: Board): Board {
  return {
    ...board,
    lanes: board.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.map((card) => ({
        ...card,
        tags: [...card.tags],
      })),
    })),
  }
}

function findCard(board: Board, cardId: string) {
  for (const lane of board.lanes) {
    const card = lane.cards.find((c) => c.id === cardId)
    if (card) {
      return { card, lane }
    }
  }
  return null
}

function laneLabel(dict: Dictionary, key: LaneKey) {
  return dict.lanes[key]
}

function isOverdue(dueAt: string | null) {
  if (!dueAt) return false
  return isBefore(parseISO(dueAt), startOfDay(new Date()))
}

function KanbanCardFace({
  card,
  dict,
  dragging,
  onOpen,
  onArchive,
  onDelete,
}: {
  card: Card
  dict: Dictionary
  dragging?: boolean
  onOpen: () => void
  onArchive?: () => void
  onDelete?: () => void
}) {
  const overdue = isOverdue(card.dueAt)
  const visibleTags = card.tags.slice(0, 3)
  const extraTags = card.tags.length - visibleTags.length

  return (
    <div
      className={cn(
        "bg-card text-card-foreground group rounded-xl border p-3 shadow-xs transition-colors",
        card.laneKey === "done" &&
          "border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15",
        card.laneKey === "canceled" && "opacity-70",
        dragging && "shadow-md ring-2 ring-ring/40"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onOpen}
        >
          <p
            className={cn(
              "text-sm font-medium leading-snug",
              card.laneKey === "canceled" && "line-through"
            )}
          >
            {card.title}
          </p>
          {card.description ? (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
              {card.description}
            </p>
          ) : null}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>{dict.card.edit}</DropdownMenuItem>
            {card.laneKey === "done" && onArchive ? (
              <DropdownMenuItem onClick={onArchive}>
                {dict.focus.archive}
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem
                variant="destructive"
                onClick={onDelete}
              >
                {dict.focus.delete}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.priority !== "normal" ? (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              card.priority === "critical" &&
                "border-destructive/40 text-destructive",
              card.priority === "high" &&
                "border-orange-500/40 text-orange-700 dark:text-orange-300",
              card.priority === "low" && "text-muted-foreground"
            )}
          >
            {card.priority === "critical"
              ? dict.card.priorityCritical
              : card.priority === "high"
                ? dict.card.priorityHigh
                : dict.card.priorityLow}
          </Badge>
        ) : null}
        {visibleTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="text-[10px]">
            {tag.name}
          </Badge>
        ))}
        {extraTags > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            +{extraTags}
          </Badge>
        ) : null}
        {card.dueAt ? (
          <span
            className={cn(
              "font-mono text-[10px]",
              overdue ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {format(parseISO(card.dueAt), "MMM d")}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function SortableCard({
  card,
  dict,
  onOpen,
  onArchive,
  onDelete,
}: {
  card: Card
  dict: Dictionary
  onOpen: () => void
  onArchive?: () => void
  onDelete?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: "card", card } })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="touch-none"
      {...attributes}
      {...listeners}
    >
      <KanbanCardFace
        card={card}
        dict={dict}
        onOpen={onOpen}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    </div>
  )
}

function LaneColumn({
  lane,
  dict,
  onOpenCard,
  onArchiveCard,
  onDeleteCard,
  onArchiveDone,
}: {
  lane: Lane
  dict: Dictionary
  onOpenCard: (card: Card) => void
  onArchiveCard: (card: Card) => void
  onDeleteCard: (card: Card) => void
  onArchiveDone: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `lane:${lane.key}`,
    data: { type: "lane", laneKey: lane.key },
  })

  return (
    <div
      className={cn(
        "bg-muted/40 flex min-h-[320px] min-w-[240px] flex-1 flex-col rounded-2xl border",
        isOver && "ring-ring/40 ring-2 ring-dashed"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h2
          className={cn(
            "text-sm font-medium",
            lane.key === "done" && "text-emerald-700 dark:text-emerald-400"
          )}
        >
          {laneLabel(dict, lane.key)}
        </h2>
        <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5">
          {lane.cards.length}
        </Badge>
        <div className="flex-1" />
        {lane.key === "done" && lane.cards.length > 0 ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={onArchiveDone}
            className="text-muted-foreground"
          >
            <Archive className="size-3.5" />
            {dict.focus.archiveDone}
          </Button>
        ) : null}
      </div>
      <ScrollArea className="flex-1 px-2 pb-2">
        <div ref={setNodeRef} className="flex min-h-[200px] flex-col gap-2 p-1">
          <SortableContext
            items={lane.cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {lane.cards.map((card) => (
              <SortableCard
                key={card.id}
                card={card}
                dict={dict}
                onOpen={() => onOpenCard(card)}
                onArchive={
                  card.laneKey === "done"
                    ? () => onArchiveCard(card)
                    : undefined
                }
                onDelete={() => onDeleteCard(card)}
              />
            ))}
          </SortableContext>
          {lane.cards.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-xl border border-dashed px-3 py-8 text-center text-xs">
              {isOver ? dict.focus.dropHere : dict.focus.emptyLane}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}

export function FocusBoard({
  initialBoard,
  dict,
}: {
  initialBoard: Board
  dict: Dictionary
}) {
  const router = useRouter()
  const [board, setBoard] = useState(() => cloneBoard(initialBoard))
  const [boardSnapshot, setBoardSnapshot] = useState(initialBoard)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null)
  const [mobileLane, setMobileLane] = useState<LaneKey>("todo")
  const [, startTransition] = useTransition()

  useCardsRealtime(initialBoard.id)

  if (initialBoard !== boardSnapshot) {
    setBoardSnapshot(initialBoard)
    setBoard(cloneBoard(initialBoard))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const totalCards = useMemo(
    () => board.lanes.reduce((sum, lane) => sum + lane.cards.length, 0),
    [board]
  )

  function openCreate() {
    setEditingCard(null)
    setEditorOpen(true)
  }

  function openEdit(card: Card) {
    setEditingCard(card)
    setEditorOpen(true)
  }

  function applyOptimisticMove(
    cardId: string,
    toLaneKey: LaneKey,
    overCardId?: string | null
  ) {
    setBoard((prev) => {
      const next = cloneBoard(prev)
      const found = findCard(next, cardId)
      if (!found) return prev

      found.lane.cards = found.lane.cards.filter((c) => c.id !== cardId)
      const target = next.lanes.find((l) => l.key === toLaneKey)
      if (!target) return prev

      const moved: Card = {
        ...found.card,
        laneId: target.id,
        laneKey: toLaneKey,
      }

      if (overCardId) {
        const index = target.cards.findIndex((c) => c.id === overCardId)
        if (index >= 0) {
          target.cards.splice(index, 0, moved)
        } else {
          target.cards.push(moved)
        }
      } else {
        target.cards.push(moved)
      }

      return next
    })
  }

  function onDragStart(event: DragStartEvent) {
    const found = findCard(board, String(event.active.id))
    setActiveCard(found?.card ?? null)
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const activeFound = findCard(board, activeId)
    if (!activeFound) return

    let toLaneKey: LaneKey | null = null
    let overCardId: string | null = null

    if (overId.startsWith("lane:")) {
      toLaneKey = overId.replace("lane:", "") as LaneKey
    } else {
      const overFound = findCard(board, overId)
      if (overFound) {
        toLaneKey = overFound.lane.key
        overCardId = overFound.card.id
      }
    }

    if (!toLaneKey || activeFound.lane.key === toLaneKey) {
      return
    }

    applyOptimisticMove(activeId, toLaneKey, overCardId)
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    const { active, over } = event
    if (!over) {
      router.refresh()
      return
    }

    const cardId = String(active.id)
    const current = findCard(board, cardId)
    if (!current) return

    const overId = String(over.id)
    let toLaneKey = current.lane.key
    let beforeCardId: string | null = null
    let afterCardId: string | null = null

    if (overId.startsWith("lane:")) {
      toLaneKey = overId.replace("lane:", "") as LaneKey
    } else {
      const overFound = findCard(board, overId)
      if (overFound) {
        toLaneKey = overFound.lane.key
      }
    }

    const targetLane = board.lanes.find((l) => l.key === toLaneKey)
    if (!targetLane) return

    const index = targetLane.cards.findIndex((c) => c.id === cardId)
    if (index > 0) {
      afterCardId = targetLane.cards[index - 1]?.id ?? null
    }
    if (index >= 0 && index < targetLane.cards.length - 1) {
      beforeCardId = targetLane.cards[index + 1]?.id ?? null
    }

    startTransition(async () => {
      const result = await moveCardAction({
        cardId,
        toLaneKey,
        beforeCardId,
        afterCardId,
      })
      if (!result.ok) {
        toast.error(dict.common.error)
        router.refresh()
      }
    })
  }

  async function handleArchive(card: Card) {
    setBoard((prev) => {
      const next = cloneBoard(prev)
      for (const lane of next.lanes) {
        lane.cards = lane.cards.filter((c) => c.id !== card.id)
      }
      return next
    })

    const result = await archiveCardAction(card.id)
    if (!result.ok) {
      toast.error(dict.common.error)
      router.refresh()
      return
    }

    toast(dict.archive.archivedToast, {
      action: {
        label: dict.archive.undo,
        onClick: () => {
          void restoreCardAction(card.id).then(() => router.refresh())
        },
      },
    })
    router.refresh()
  }

  async function handleArchiveDone() {
    const result = await archiveDoneCardsAction()
    if (!result.ok) {
      toast.error(dict.common.error)
      return
    }
    toast(dict.archive.archivedToast)
    router.refresh()
  }

  async function handleDelete(card: Card) {
    setBoard((prev) => {
      const next = cloneBoard(prev)
      for (const lane of next.lanes) {
        lane.cards = lane.cards.filter((c) => c.id !== card.id)
      }
      return next
    })

    const result = await deleteCardAction(card.id)
    if (!result.ok) {
      toast.error(dict.common.error)
      router.refresh()
      return
    }

    toast(dict.card.deletedToast)
    setEditorOpen(false)
    setEditingCard(null)
    setDeleteTarget(null)
    router.refresh()
  }

  async function handleSave(values: {
    title: string
    description: string
    dueAt: string | null
    laneKey: LaneKey
    tagNames: string[]
  }) {
    if (editingCard) {
      const result = await updateCardAction({
        cardId: editingCard.id,
        ...values,
      })
      if (!result.ok) {
        toast.error(dict.common.error)
        return
      }
    } else {
      const result = await createCardAction(values)
      if (!result.ok) {
        toast.error(dict.common.error)
        return
      }
    }
    setEditorOpen(false)
    router.refresh()
  }

  const desktopLanes = board.lanes
  const mobileLaneData = board.lanes.find((l) => l.key === mobileLane)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AppTopBar
        title={dict.focus.title}
        scope={
          <Badge variant="outline" className="rounded-full font-normal">
            {dict.focus.scopeToday}
          </Badge>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/focus/archive" />}
            >
              {dict.focus.archiveLink}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus />
              {dict.focus.newCard}
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        {totalCards === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-base font-medium">{dict.focus.emptyBoard}</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              {dict.focus.emptyBoardHint}
            </p>
            <Button onClick={openCreate}>
              <Plus />
              {dict.focus.newCard}
            </Button>
          </div>
        ) : (
          <>
            <div className="md:hidden">
              <Tabs
                value={mobileLane}
                onValueChange={(value) => {
                  if (LANE_KEYS.includes(value as LaneKey)) {
                    setMobileLane(value as LaneKey)
                  }
                }}
              >
                <TabsList className="w-full">
                  {LANE_KEYS.map((key) => (
                    <TabsTrigger key={key} value={key} className="flex-1">
                      {laneLabel(dict, key)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {mobileLaneData ? (
                <div className="mt-3">
                  <LaneColumn
                    lane={mobileLaneData}
                    dict={dict}
                    onOpenCard={openEdit}
                    onArchiveCard={handleArchive}
                    onDeleteCard={setDeleteTarget}
                    onArchiveDone={handleArchiveDone}
                  />
                </div>
              ) : null}
            </div>

            <div className="hidden min-h-0 flex-1 md:block">
              <DndContext
                id="focus-board"
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
              >
                <div className="flex h-full gap-3 overflow-x-auto pb-2">
                  {desktopLanes.map((lane) => (
                    <LaneColumn
                      key={lane.id}
                      lane={lane}
                      dict={dict}
                      onOpenCard={openEdit}
                      onArchiveCard={handleArchive}
                      onDeleteCard={setDeleteTarget}
                      onArchiveDone={handleArchiveDone}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeCard ? (
                    <KanbanCardFace
                      card={activeCard}
                      dict={dict}
                      dragging
                      onOpen={() => undefined}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </>
        )}
      </div>

      <CardEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        card={editingCard}
        dict={dict}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.card.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>
              {dict.card.deleteConfirmDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {dict.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  void handleDelete(deleteTarget)
                }
              }}
            >
              {dict.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
