"use client"

import { format, parseISO } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  deleteCardAction,
  restoreCardAction,
} from "@/features/kanban/actions/cards"
import type { Card } from "@/features/kanban/domain/types"
import type { Dictionary } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppTopBar } from "@/components/shell/app-top-bar"

export function ArchiveList({
  cards,
  dict,
}: {
  cards: Card[]
  dict: Dictionary
}) {
  const router = useRouter()

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AppTopBar
        title={dict.archive.title}
        actions={
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/focus" />}
          >
            {dict.archive.backToBoard}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {cards.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground max-w-md text-sm">
              {dict.archive.empty}
            </p>
            <Button nativeButton={false} render={<Link href="/focus" />}>
              {dict.archive.backToBoard}
            </Button>
          </div>
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col gap-2">
            {cards.map((card) => (
              <li
                key={card.id}
                className="bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{card.title}</p>
                  {card.description ? (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                      {card.description}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {card.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary">
                        {tag.name}
                      </Badge>
                    ))}
                    {card.archivedAt ? (
                      <span className="text-muted-foreground font-mono text-xs">
                        {dict.archive.archivedAt}{" "}
                        {format(parseISO(card.archivedAt), "MMM d, yyyy")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const result = await restoreCardAction(card.id)
                      if (!result.ok) {
                        toast.error(dict.common.error)
                        return
                      }
                      toast(dict.archive.restoredToast)
                      router.refresh()
                    }}
                  >
                    {dict.focus.restore}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      const result = await deleteCardAction(card.id)
                      if (!result.ok) {
                        toast.error(dict.common.error)
                        return
                      }
                      router.refresh()
                    }}
                  >
                    {dict.focus.delete}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
