"use client"

import { LayoutGrid, List, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import {
  createContactAction,
  deleteContactAction,
  updateContactAction,
} from "@/features/contacts/actions/contacts"
import {
  CONTACT_GROUPS,
  type ContactGroup,
  type ImportantContact,
} from "@/features/contacts/domain/types"
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

type ViewMode = "cards" | "table"

const VIEW_MODE_KEY = "contacts-view-mode"

function ContactActions({
  contact,
  dict,
  onEdit,
  onDelete,
}: Readonly<{
  contact: ImportantContact
  dict: Dictionary
  onEdit: (contact: ImportantContact) => void
  onDelete: (contact: ImportantContact) => void
}>) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onEdit(contact)}
      >
        <Pencil />
        <span className="sr-only">{dict.common.edit}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete(contact)}
      >
        <Trash2 />
        <span className="sr-only">{dict.common.delete}</span>
      </Button>
    </div>
  )
}

function groupLabel(group: ContactGroup, dict: Dictionary): string {
  return dict.contacts.groups[group]
}

export function ContactsList({
  contacts,
  dict,
}: Readonly<{
  contacts: ImportantContact[]
  dict: Dictionary
}>) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "cards"
    const stored = window.localStorage.getItem(VIEW_MODE_KEY)
    return stored === "cards" || stored === "table" ? stored : "cards"
  })
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ImportantContact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ImportantContact | null>(
    null
  )
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [contactGroup, setContactGroup] = useState<ContactGroup>("family")
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
    setContactGroup("family")
    setError(null)
    setEditorOpen(true)
  }

  function openEdit(contact: ImportantContact) {
    setEditing(contact)
    setName(contact.name)
    setPhone(contact.phone)
    setContactGroup(contact.contactGroup)
    setError(null)
    setEditorOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(dict.contacts.nameRequired)
      return
    }
    if (!phone.trim()) {
      setError(dict.contacts.phoneRequired)
      return
    }
    if (!contactGroup) {
      setError(dict.contacts.groupRequired)
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        contactGroup,
      }
      const result = editing
        ? await updateContactAction({ id: editing.id, ...payload })
        : await createContactAction(payload)

      if (!result.ok) {
        if (result.error.code === "CONFLICT") {
          setError(dict.contacts.phoneDuplicate)
          return
        }
        toast.error(dict.common.error)
        return
      }

      toast(dict.contacts.savedToast)
      setEditorOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const byGroup = CONTACT_GROUPS.map((group) => ({
    group,
    items: contacts.filter((c) => c.contactGroup === group),
  })).filter((section) => section.items.length > 0)

  let content: ReactNode
  if (contacts.length === 0) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-base font-medium">{dict.contacts.empty}</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {dict.contacts.emptyHint}
        </p>
        <Button onClick={openCreate}>
          <Plus />
          {dict.contacts.newContact}
        </Button>
      </div>
    )
  } else if (viewMode === "cards") {
    content = (
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        {byGroup.map(({ group, items }) => (
          <section key={group} className="space-y-3">
            <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {groupLabel(group, dict)}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((contact) => (
                <li
                  key={contact.id}
                  className="bg-card flex items-center gap-3 rounded-xl border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-muted-foreground font-mono text-sm">
                      {contact.phone}
                    </p>
                  </div>
                  <ContactActions
                    contact={contact}
                    dict={dict}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  } else {
    content = (
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        {byGroup.map(({ group, items }) => (
          <section key={group} className="space-y-3">
            <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {groupLabel(group, dict)}
            </h2>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b text-left">
                    <th className="px-4 py-3 font-medium">
                      {dict.contacts.name}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {dict.contacts.phone}
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      {dict.contacts.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((contact) => (
                    <tr key={contact.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{contact.name}</td>
                      <td className="text-muted-foreground px-4 py-3 font-mono">
                        {contact.phone}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <ContactActions
                            contact={contact}
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
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AppTopBar
        title={dict.contacts.title}
        actions={
          <>
            {contacts.length > 0 ? (
              <fieldset className="m-0 flex items-center rounded-2xl border p-0.5">
                <legend className="sr-only">{dict.contacts.title}</legend>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-pressed={viewMode === "cards"}
                  aria-label={dict.contacts.viewCards}
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
                  aria-label={dict.contacts.viewTable}
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
              {dict.contacts.newContact}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">{content}</div>

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing ? dict.contacts.editContact : dict.contacts.newContact}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 px-6">
            <div className="space-y-2">
              <Label htmlFor="contact-name">{dict.contacts.name}</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">{dict.contacts.phone}</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{dict.contacts.group}</Label>
              <Select
                value={contactGroup}
                onValueChange={(value) => {
                  if (
                    value &&
                    (CONTACT_GROUPS as readonly string[]).includes(value)
                  ) {
                    setContactGroup(value as ContactGroup)
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_GROUPS.map((group) => (
                    <SelectItem key={group} value={group}>
                      {groupLabel(group, dict)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <DialogTitle>{dict.contacts.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>
              {dict.contacts.deleteConfirmDescription}
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
                const result = await deleteContactAction(deleteTarget.id)
                if (!result.ok) {
                  toast.error(dict.common.error)
                  return
                }
                toast(dict.contacts.deletedToast)
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
