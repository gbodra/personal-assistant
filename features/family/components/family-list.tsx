"use client"

import { LayoutGrid, List, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import {
  createFamilyMemberAction,
  deleteFamilyMemberAction,
  updateFamilyMemberAction,
} from "@/features/family/actions/members"
import type { FamilyMember } from "@/features/family/domain/types"
import type { Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { AppTopBar } from "@/components/shell/app-top-bar"
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type ViewMode = "cards" | "table"

const VIEW_MODE_KEY = "family-view-mode"

function MemberActions({
  member,
  dict,
  onEdit,
  onDelete,
}: Readonly<{
  member: FamilyMember
  dict: Dictionary
  onEdit: (member: FamilyMember) => void
  onDelete: (member: FamilyMember) => void
}>) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onEdit(member)}
      >
        <Pencil />
        <span className="sr-only">{dict.common.edit}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete(member)}
      >
        <Trash2 />
        <span className="sr-only">{dict.common.delete}</span>
      </Button>
    </div>
  )
}

export function FamilyList({
  members,
  dict,
}: Readonly<{
  members: FamilyMember[]
  dict: Dictionary
}>) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "cards"
    const stored = window.localStorage.getItem(VIEW_MODE_KEY)
    return stored === "cards" || stored === "table" ? stored : "cards"
  })
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<FamilyMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FamilyMember | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function setAndPersistViewMode(mode: ViewMode) {
    setViewMode(mode)
    window.localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  function openCreate() {
    setEditing(null)
    setName("")
    setPhone("")
    setError(null)
    setEditorOpen(true)
  }

  function openEdit(member: FamilyMember) {
    setEditing(member)
    setName(member.name)
    setPhone(member.phone)
    setError(null)
    setEditorOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(dict.family.nameRequired)
      return
    }
    if (!phone.trim()) {
      setError(dict.family.phoneRequired)
      return
    }

    setSaving(true)
    try {
      const result = editing
        ? await updateFamilyMemberAction({
            id: editing.id,
            name: name.trim(),
            phone: phone.trim(),
          })
        : await createFamilyMemberAction({
            name: name.trim(),
            phone: phone.trim(),
          })

      if (!result.ok) {
        toast.error(dict.common.error)
        return
      }

      toast(dict.family.savedToast)
      setEditorOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  let content: ReactNode
  if (members.length === 0) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-base font-medium">{dict.family.empty}</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {dict.family.emptyHint}
        </p>
        <Button onClick={openCreate}>
          <Plus />
          {dict.family.newMember}
        </Button>
      </div>
    )
  } else if (viewMode === "cards") {
    content = (
      <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="bg-card flex items-center gap-3 rounded-xl border p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{member.name}</p>
              <p className="text-muted-foreground font-mono text-sm">
                {member.phone}
              </p>
            </div>
            <MemberActions
              member={member}
              dict={dict}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          </li>
        ))}
      </ul>
    )
  } else {
    content = (
      <div className="mx-auto max-w-4xl overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-left">
              <th className="px-4 py-3 font-medium">{dict.family.name}</th>
              <th className="px-4 py-3 font-medium">{dict.family.phone}</th>
              <th className="px-4 py-3 text-right font-medium">
                {dict.family.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{member.name}</td>
                <td className="text-muted-foreground px-4 py-3 font-mono">
                  {member.phone}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <MemberActions
                      member={member}
                      dict={dict}
                      onEdit={openEdit}
                      onDelete={setDeleteTarget}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AppTopBar
        title={dict.family.title}
        actions={
          <>
            {members.length > 0 ? (
              <fieldset className="m-0 flex items-center rounded-2xl border p-0.5">
                <legend className="sr-only">{dict.family.title}</legend>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-pressed={viewMode === "cards"}
                  aria-label={dict.family.viewCards}
                  className={cn(
                    viewMode === "cards" && "bg-muted text-foreground"
                  )}
                  onClick={() => setAndPersistViewMode("cards")}
                >
                  <LayoutGrid />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-pressed={viewMode === "table"}
                  aria-label={dict.family.viewTable}
                  className={cn(
                    viewMode === "table" && "bg-muted text-foreground"
                  )}
                  onClick={() => setAndPersistViewMode("table")}
                >
                  <List />
                </Button>
              </fieldset>
            ) : null}
            <Button size="sm" onClick={openCreate}>
              <Plus />
              {dict.family.newMember}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">{content}</div>

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing ? dict.family.editMember : dict.family.newMember}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 px-6">
            <div className="space-y-2">
              <Label htmlFor="family-name">{dict.family.name}</Label>
              <Input
                id="family-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="family-phone">{dict.family.phone}</Label>
              <Input
                id="family-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>
          <SheetFooter className="border-t">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              {dict.common.cancel}
            </Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              {dict.common.save}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.family.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>
              {dict.family.deleteConfirmDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {dict.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return
                const result = await deleteFamilyMemberAction(deleteTarget.id)
                if (!result.ok) {
                  toast.error(dict.common.error)
                  return
                }
                toast(dict.family.deletedToast)
                setDeleteTarget(null)
                router.refresh()
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
