"use client"

import { Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import {
  createFamilyMemberAction,
  deleteFamilyMemberAction,
  updateFamilyMemberAction,
} from "@/features/family/actions/members"
import type { FamilyMember } from "@/features/family/domain/types"
import type { Dictionary } from "@/lib/i18n"
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

export function FamilyList({
  members,
  dict,
}: {
  members: FamilyMember[]
  dict: Dictionary
}) {
  const router = useRouter()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<FamilyMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FamilyMember | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AppTopBar
        title={dict.family.title}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus />
            {dict.family.newMember}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {members.length === 0 ? (
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
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-2">
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
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(member)}
                >
                  <Pencil />
                  <span className="sr-only">{dict.common.edit}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleteTarget(member)}
                >
                  <Trash2 />
                  <span className="sr-only">{dict.common.delete}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
