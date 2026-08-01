"use client"

import { useState } from "react"
import { X } from "lucide-react"

import type { Card, LaneKey } from "@/features/kanban/domain/types"
import { LANE_KEYS } from "@/features/kanban/domain/types"
import type { Dictionary } from "@/lib/i18n"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

function toDateInputValue(iso: string | null) {
  if (!iso) return ""
  return iso.slice(0, 10)
}

function fromDateInputValue(value: string): string | null {
  if (!value) return null
  return new Date(`${value}T12:00:00.000Z`).toISOString()
}

type FormState = {
  title: string
  description: string
  dueAt: string
  laneKey: LaneKey
  tagNames: string[]
  tagDraft: string
}

function formFromCard(card: Card | null): FormState {
  return {
    title: card?.title ?? "",
    description: card?.description ?? "",
    dueAt: toDateInputValue(card?.dueAt ?? null),
    laneKey: card?.laneKey ?? "todo",
    tagNames: card?.tags.map((t) => t.name) ?? [],
    tagDraft: "",
  }
}

function CardEditorForm({
  card,
  dict,
  onCancel,
  onSave,
  onDelete,
}: {
  card: Card | null
  dict: Dictionary
  onCancel: () => void
  onSave: (values: {
    title: string
    description: string
    dueAt: string | null
    laneKey: LaneKey
    tagNames: string[]
  }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState(() => formFromCard(card))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function addTag() {
    const value = form.tagDraft.trim()
    if (!value) return
    if (!form.tagNames.includes(value)) {
      setForm((prev) => ({
        ...prev,
        tagNames: [...prev.tagNames, value],
        tagDraft: "",
      }))
      return
    }
    setForm((prev) => ({ ...prev, tagDraft: "" }))
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6">
        <div className="space-y-2">
          <Label htmlFor="card-title">{dict.card.title}</Label>
          <Input
            id="card-title"
            value={form.title}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, title: e.target.value }))
            }
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-description">{dict.card.description}</Label>
          <Textarea
            id="card-description"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label>{dict.card.status}</Label>
          <Select
            value={form.laneKey}
            onValueChange={(value) => {
              if (value && LANE_KEYS.includes(value as LaneKey)) {
                setForm((prev) => ({ ...prev, laneKey: value as LaneKey }))
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANE_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {dict.lanes[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-due">{dict.card.dueDate}</Label>
          <Input
            id="card-due"
            type="date"
            value={form.dueAt}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, dueAt: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-tags">{dict.card.tags}</Label>
          <div className="flex gap-2">
            <Input
              id="card-tags"
              value={form.tagDraft}
              placeholder={dict.card.tagsPlaceholder}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tagDraft: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addTag}>
              {dict.card.addTag}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {form.tagNames.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  className="hover:bg-muted rounded-full p-0.5"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      tagNames: prev.tagNames.filter((t) => t !== tag),
                    }))
                  }
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {card ? (
          <p className="text-muted-foreground font-mono text-xs">
            {dict.focus.created}: {new Date(card.createdAt).toLocaleString()}
          </p>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>

      <SheetFooter className="border-t">
        {card && onDelete ? (
          <Button
            variant="destructive"
            className="mr-auto"
            onClick={() => setConfirmDelete(true)}
          >
            {dict.focus.delete}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onCancel}>
          {dict.card.cancel}
        </Button>
        <Button
          disabled={saving}
          onClick={async () => {
            if (!form.title.trim()) {
              setError(dict.card.titleRequired)
              return
            }
            setSaving(true)
            try {
              await onSave({
                title: form.title.trim(),
                description: form.description,
                dueAt: fromDateInputValue(form.dueAt),
                laneKey: form.laneKey,
                tagNames: form.tagNames,
              })
            } finally {
              setSaving(false)
            }
          }}
        >
          {card ? dict.card.save : dict.card.create}
        </Button>
      </SheetFooter>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.card.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>
              {dict.card.deleteConfirmDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {dict.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!onDelete) return
                setDeleting(true)
                try {
                  await onDelete()
                  setConfirmDelete(false)
                } finally {
                  setDeleting(false)
                }
              }}
            >
              {dict.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CardEditorSheet({
  open,
  onOpenChange,
  card,
  dict,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: Card | null
  dict: Dictionary
  onSave: (values: {
    title: string
    description: string
    dueAt: string | null
    laneKey: LaneKey
    tagNames: string[]
  }) => Promise<void>
  onDelete?: (card: Card) => Promise<void>
}) {
  const formKey = `${open ? "open" : "closed"}-${card?.id ?? "new"}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {card ? dict.card.edit : dict.card.create}
          </SheetTitle>
        </SheetHeader>
        {open ? (
          <CardEditorForm
            key={formKey}
            card={card}
            dict={dict}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
            onDelete={
              card && onDelete
                ? async () => {
                    await onDelete(card)
                  }
                : undefined
            }
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
