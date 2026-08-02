"use client"

import { LayoutGrid, List, Mic, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import {
  compileRuleAction,
  createRuleAction,
  deleteRuleAction,
  setRuleEnabledAction,
  updateRuleAction,
} from "@/features/message-rules/actions/rules"
import type {
  ContactList,
  MessageRule,
  MessageRuleDraft,
  Priority,
  RuleActions,
  RuleCondition,
} from "@/features/message-rules/domain/types"
import { PRIORITIES } from "@/features/message-rules/domain/types"
import {
  conditionLabel,
  listItemSummary,
  mirrorSentence,
} from "@/features/message-rules/domain/summary"
import type { Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { AppTopBar } from "@/components/shell/app-top-bar"
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

type Step = "describe" | "confirm"
type ViewMode = "cards" | "table"

const VIEW_MODE_KEY = "rules-view-mode"

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function RuleRowActions({
  rule,
  dict,
  onEdit,
  onDelete,
}: Readonly<{
  rule: MessageRule
  dict: Dictionary
  onEdit: (rule: MessageRule) => void
  onDelete: (rule: MessageRule) => void
}>) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={() => onEdit(rule)}>
        <Pencil />
        <span className="sr-only">{dict.common.edit}</span>
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => onDelete(rule)}>
        <Trash2 />
        <span className="sr-only">{dict.common.delete}</span>
      </Button>
    </div>
  )
}

function EnabledSwitch({
  rule,
  dict,
  onToggle,
}: Readonly<{
  rule: MessageRule
  dict: Dictionary
  onToggle: (rule: MessageRule) => void
}>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rule.enabled}
      aria-label={rule.enabled ? dict.rules.active : dict.rules.paused}
      onClick={() => onToggle(rule)}
      className={cn(
        "h-5 w-9 shrink-0 rounded-full border transition-colors",
        rule.enabled
          ? "border-primary bg-primary"
          : "border-muted-foreground/40 bg-muted"
      )}
    >
      <span
        className={cn(
          "bg-background block size-4 translate-x-0.5 rounded-full shadow transition-transform",
          rule.enabled && "translate-x-4"
        )}
      />
    </button>
  )
}

export function RulesList({
  rules,
  dict,
  contactCounts,
  locale,
}: Readonly<{
  rules: MessageRule[]
  dict: Dictionary
  contactCounts: Record<ContactList, number>
  locale: string
}>) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "cards"
    const stored = window.localStorage.getItem(VIEW_MODE_KEY)
    return stored === "cards" || stored === "table" ? stored : "cards"
  })
  const [editorOpen, setEditorOpen] = useState(false)
  const [step, setStep] = useState<Step>("describe")
  const [editing, setEditing] = useState<MessageRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MessageRule | null>(null)
  const [utterance, setUtterance] = useState("")
  const [draft, setDraft] = useState<MessageRuleDraft | null>(null)
  const [tagDraft, setTagDraft] = useState("")
  const [themeDraft, setThemeDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [interpreting, setInterpreting] = useState(false)
  const [listening, setListening] = useState(false)
  const [micSupported, setMicSupported] = useState(() =>
    Boolean(getSpeechRecognition())
  )
  const [confirmed, setConfirmed] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  function resetEditor() {
    setStep("describe")
    setEditing(null)
    setUtterance("")
    setDraft(null)
    setTagDraft("")
    setThemeDraft("")
    setError(null)
    setConfirmed(false)
    setInterpreting(false)
  }

  function openCreate() {
    resetEditor()
    setEditorOpen(true)
  }

  function openEdit(rule: MessageRule) {
    resetEditor()
    setEditing(rule)
    setUtterance(rule.sourceUtterance ?? rule.name)
    setDraft({
      name: rule.name,
      conditions: rule.conditions,
      actions: rule.actions,
      isCatchAll: rule.isCatchAll,
      sourceUtterance: rule.sourceUtterance ?? rule.name,
      tagNames:
        rule.actions.disposition === "create"
          ? (rule.actions.tag_names ?? [])
          : [],
      warnings: [],
    })
    setStep("confirm")
    setConfirmed(true)
    setEditorOpen(true)
  }

  async function handleInterpret() {
    setError(null)
    if (!utterance.trim()) {
      setError(dict.rules.describeHint)
      return
    }
    setInterpreting(true)
    const result = await compileRuleAction(utterance)
    setInterpreting(false)
    if (!result.ok) {
      setError(
        result.error.message === "RATE_LIMITED"
          ? dict.rules.rateLimited
          : result.error.message
      )
      return
    }
    setDraft(result.data)
    setConfirmed(false)
    setStep("confirm")
  }

  function updateActions(next: RuleActions) {
    if (!draft) return
    setDraft({
      ...draft,
      actions: next,
      tagNames: next.disposition === "create" ? (next.tag_names ?? draft.tagNames) : [],
    })
    setConfirmed(true)
  }

  function setPriority(priority: Priority) {
    if (!draft || draft.actions.disposition !== "create") return
    updateActions({ ...draft.actions, priority })
  }

  function setDisposition(disposition: "create" | "ignore") {
    if (!draft) return
    if (disposition === "ignore") {
      updateActions({ disposition: "ignore" })
      return
    }
    updateActions({
      disposition: "create",
      priority:
        draft.actions.disposition === "create"
          ? draft.actions.priority
          : "normal",
      tag_ids: [],
      tag_names: draft.tagNames,
      lane_key: "todo",
    })
  }

  function addTag() {
    if (!draft || draft.actions.disposition !== "create") return
    const name = tagDraft.trim()
    if (!name) return
    const tagNames = [...new Set([...draft.tagNames, name])]
    setTagDraft("")
    setDraft({
      ...draft,
      tagNames,
      actions: { ...draft.actions, tag_names: tagNames },
    })
    setConfirmed(true)
  }

  function removeTag(name: string) {
    if (!draft || draft.actions.disposition !== "create") return
    const tagNames = draft.tagNames.filter((t) => t !== name)
    setDraft({
      ...draft,
      tagNames,
      actions: { ...draft.actions, tag_names: tagNames },
    })
    setConfirmed(true)
  }

  function updateConditions(conditions: RuleCondition[]) {
    if (!draft) return
    setDraft({ ...draft, conditions, isCatchAll: false })
    setConfirmed(true)
  }

  function addTheme() {
    if (!draft) return
    const theme = themeDraft.trim()
    if (!theme) return
    const existing = draft.conditions.find((c) => c.type === "theme_any")
    if (existing && existing.type === "theme_any") {
      if (existing.themes.includes(theme)) {
        setThemeDraft("")
        return
      }
      updateConditions(
        draft.conditions.map((c) =>
          c.type === "theme_any"
            ? { ...c, themes: [...c.themes, theme].slice(0, 10) }
            : c
        )
      )
    } else {
      updateConditions([
        ...draft.conditions,
        { type: "theme_any", themes: [theme] },
      ])
    }
    setThemeDraft("")
  }

  function removeTheme(theme: string) {
    if (!draft) return
    updateConditions(
      draft.conditions
        .map((c) => {
          if (c.type !== "theme_any") return c
          return { ...c, themes: c.themes.filter((t) => t !== theme) }
        })
        .filter((c) => c.type !== "theme_any" || c.themes.length > 0)
    )
  }

  function setCatchAll(value: boolean) {
    if (!draft) return
    setDraft({
      ...draft,
      isCatchAll: value,
      conditions: value ? [] : draft.conditions,
    })
    setConfirmed(true)
  }

  function canSave(current: MessageRuleDraft): boolean {
    if (current.actions.disposition !== "create" && current.actions.disposition !== "ignore") {
      return false
    }
    if (!current.isCatchAll && current.conditions.length === 0) {
      return false
    }
    return true
  }

  async function handleSave() {
    if (!draft) return
    setError(null)
    if (!canSave(draft)) {
      setError(
        !draft.isCatchAll && draft.conditions.length === 0
          ? dict.rules.missingCondition
          : dict.rules.missingAction
      )
      return
    }
    if (!confirmed) {
      setError(dict.rules.confirmChecked)
      return
    }

    setSaving(true)
    const payload = {
      name: draft.name,
      enabled: true,
      conditions: draft.conditions as RuleCondition[],
      actions:
        draft.actions.disposition === "ignore"
          ? ({ disposition: "ignore" } as const)
          : {
              disposition: "create" as const,
              priority: draft.actions.priority,
              tag_ids: [],
              tag_names: draft.tagNames,
              lane_key: "todo" as const,
            },
      isCatchAll: draft.isCatchAll,
      sourceUtterance: draft.sourceUtterance,
      tagNames: draft.tagNames,
    }

    const result = editing
      ? await updateRuleAction({ id: editing.id, ...payload })
      : await createRuleAction(payload)

    setSaving(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }

    toast(dict.rules.savedToast)
    setEditorOpen(false)
    resetEditor()
    router.refresh()
  }

  function toggleMic() {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setMicSupported(false)
      return
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }
    const recognition = new Ctor()
    recognition.lang = locale === "pt" ? "pt-BR" : "en-US"
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ""
      if (transcript) {
        setUtterance((prev) => (prev ? `${prev} ${transcript}` : transcript))
      }
    }
    recognition.onerror = () => {
      setError(dict.rules.micError)
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setError(null)
    setListening(true)
    recognition.start()
  }

  async function toggleEnabled(rule: MessageRule) {
    const result = await setRuleEnabledAction({
      id: rule.id,
      enabled: !rule.enabled,
    })
    if (!result.ok) {
      toast(result.error.message)
      return
    }
    router.refresh()
  }

  const examples = [
    dict.rules.exampleFamily,
    dict.rules.exampleGroup,
    dict.rules.exampleSpam,
  ]

  function setAndPersistViewMode(mode: ViewMode) {
    setViewMode(mode)
    window.localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  let content: ReactNode
  if (rules.length === 0) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-base font-medium">{dict.rules.empty}</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {dict.rules.emptyHint}
        </p>
        <Button onClick={openCreate}>
          <Plus />
          {dict.rules.newRule}
        </Button>
      </div>
    )
  } else if (viewMode === "cards") {
    content = (
      <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "bg-card flex items-center gap-3 rounded-xl border p-4",
              !rule.enabled && "opacity-60"
            )}
          >
            <EnabledSwitch
              rule={rule}
              dict={dict}
              onToggle={(r) => void toggleEnabled(r)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{rule.name}</p>
                {rule.isCatchAll ? (
                  <Badge variant="outline" className="text-[10px]">
                    {dict.rules.catchAll}
                  </Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                {listItemSummary(rule, dict)}
              </p>
            </div>
            <RuleRowActions
              rule={rule}
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
              <th className="px-4 py-3 font-medium">{dict.rules.status}</th>
              <th className="px-4 py-3 font-medium">{dict.rules.name}</th>
              <th className="px-4 py-3 font-medium">{dict.rules.summary}</th>
              <th className="px-4 py-3 text-right font-medium">
                {dict.rules.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr
                key={rule.id}
                className={cn(
                  "border-b last:border-b-0",
                  !rule.enabled && "opacity-60"
                )}
              >
                <td className="px-4 py-3">
                  <EnabledSwitch
                    rule={rule}
                    dict={dict}
                    onToggle={(r) => void toggleEnabled(r)}
                  />
                </td>
                <td className="px-4 py-3 font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{rule.name}</span>
                    {rule.isCatchAll ? (
                      <Badge variant="outline" className="text-[10px]">
                        {dict.rules.catchAll}
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {listItemSummary(rule, dict)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <RuleRowActions
                      rule={rule}
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
        title={dict.rules.title}
        actions={
          <>
            {rules.length > 0 ? (
              <fieldset className="m-0 flex items-center rounded-2xl border p-0.5">
                <legend className="sr-only">{dict.rules.title}</legend>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-pressed={viewMode === "cards"}
                  aria-label={dict.rules.viewCards}
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
                  aria-label={dict.rules.viewTable}
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
              {dict.rules.newRule}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">{content}</div>

      <Sheet
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) resetEditor()
        }}
      >
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editing ? dict.rules.editRule : dict.rules.newRule}
            </SheetTitle>
            <p className="text-muted-foreground text-xs">
              {step === "describe"
                ? dict.rules.stepDescribe
                : dict.rules.stepConfirm}
            </p>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 pb-4">
            {step === "describe" ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {dict.rules.describeHint}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="rule-utterance">{dict.rules.title}</Label>
                  <div className="relative">
                    <Textarea
                      id="rule-utterance"
                      value={utterance}
                      onChange={(e) => setUtterance(e.target.value)}
                      placeholder={dict.rules.placeholder}
                      rows={5}
                      disabled={interpreting}
                      className="pr-12"
                    />
                    <Button
                      type="button"
                      variant={listening ? "default" : "ghost"}
                      size="icon-sm"
                      className="absolute top-2 right-2"
                      disabled={!micSupported || interpreting}
                      onClick={toggleMic}
                      title={
                        micSupported
                          ? dict.rules.micListening
                          : dict.rules.micUnsupported
                      }
                    >
                      <Mic />
                    </Button>
                  </div>
                  {!micSupported ? (
                    <p className="text-muted-foreground text-xs">
                      {dict.rules.micUnsupported}
                    </p>
                  ) : null}
                  {listening ? (
                    <p className="text-primary text-xs">{dict.rules.micListening}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="bg-muted hover:bg-muted/80 rounded-full px-3 py-1 text-left text-xs"
                      onClick={() => setUtterance(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                {interpreting ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      {dict.rules.interpreting}
                    </p>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : null}
              </>
            ) : draft ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {mirrorSentence(draft, dict)}
                </p>

                {draft.warnings.length > 0 ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                    <ul className="list-inside list-disc space-y-1">
                      {draft.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!draft.isCatchAll && draft.conditions.length === 0 ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                    <p>{dict.rules.missingCondition}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => setCatchAll(true)}
                    >
                      {dict.rules.makeCatchAll}
                    </Button>
                  </div>
                ) : null}

                {(() => {
                  const emptyList = draft.conditions.find(
                    (c): c is Extract<RuleCondition, { type: "from_list" }> =>
                      c.type === "from_list" && contactCounts[c.list] === 0
                  )
                  if (!emptyList) return null
                  return (
                    <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs">
                      <p>
                        {dict.rules.contactsEmpty.replace(
                          "{group}",
                          dict.contacts.groups[emptyList.list]
                        )}
                      </p>
                      <Link
                        href="/contacts"
                        className="text-primary mt-2 inline-flex text-xs font-medium underline-offset-4 hover:underline"
                      >
                        {dict.rules.openContacts}
                      </Link>
                    </div>
                  )
                })()}

                <section className="space-y-3">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    {dict.rules.when}
                  </p>

                  {draft.isCatchAll ? (
                    <Badge variant="secondary">{dict.rules.catchAll}</Badge>
                  ) : draft.conditions.length === 0 ? (
                    <Badge variant="outline">{dict.rules.unknownWhen}</Badge>
                  ) : (
                    <>
                      {(() => {
                        const whoConditions = draft.conditions.filter(
                          (c) => c.type !== "theme_any"
                        )
                        const themeCondition = draft.conditions.find(
                          (c) => c.type === "theme_any"
                        )
                        const themes =
                          themeCondition?.type === "theme_any"
                            ? themeCondition.themes
                            : []
                        const hasWho = whoConditions.length > 0

                        return (
                          <>
                            {hasWho ? (
                              <div className="space-y-2">
                                <Label>{dict.rules.whoLabel}</Label>
                                <div className="flex flex-wrap gap-1.5">
                                  {whoConditions.map((condition, index) => (
                                    <Badge
                                      key={`${condition.type}-${index}`}
                                      variant="secondary"
                                    >
                                      {conditionLabel(condition, dict)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="space-y-2">
                              <Label>{dict.rules.themesLabel}</Label>
                              <p className="text-muted-foreground text-xs">
                                {dict.rules.themesHint}
                              </p>
                              {hasWho && themes.length === 0 ? (
                                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                                  {dict.rules.missingThemes}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-1.5">
                                {themes.map((theme) => (
                                  <Badge
                                    key={theme}
                                    variant="secondary"
                                    className="cursor-pointer"
                                    onClick={() => removeTheme(theme)}
                                  >
                                    {theme} ×
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  value={themeDraft}
                                  onChange={(e) =>
                                    setThemeDraft(e.target.value)
                                  }
                                  placeholder={dict.rules.themePlaceholder}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault()
                                      addTheme()
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={addTheme}
                                >
                                  {dict.rules.addTheme}
                                </Button>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </>
                  )}
                </section>

                <section className="space-y-3">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    {dict.rules.then}
                  </p>

                  <div className="space-y-2">
                    <Label>{dict.rules.dispositionLabel}</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          draft.actions.disposition === "create"
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setDisposition("create")}
                      >
                        {dict.rules.createCard}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          draft.actions.disposition === "ignore"
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setDisposition("ignore")}
                      >
                        {dict.rules.ignoreMessage}
                      </Button>
                    </div>
                    {draft.actions.disposition === "ignore" ? (
                      <p className="text-muted-foreground text-xs">
                        {dict.rules.ignoreHint}
                      </p>
                    ) : null}
                  </div>

                  {draft.actions.disposition === "create" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{dict.rules.priorityLabel}</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {PRIORITIES.map((priority) => (
                            <Button
                              key={priority}
                              type="button"
                              size="sm"
                              variant={
                                draft.actions.disposition === "create" &&
                                draft.actions.priority === priority
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => setPriority(priority)}
                            >
                              {dict.rules.priority[priority]}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{dict.rules.tagsLabel}</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {draft.tagNames.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="cursor-pointer"
                              onClick={() => removeTag(tag)}
                            >
                              {tag} ×
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            placeholder={dict.rules.addTag}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                addTag()
                              }
                            }}
                          />
                          <Button type="button" variant="outline" onClick={addTag}>
                            {dict.rules.addTag}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </section>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  {dict.rules.confirmChecked}
                </label>
              </>
            ) : null}

            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <SheetFooter className="gap-2 sm:flex-row">
            {step === "confirm" ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("describe")
                  setError(null)
                }}
              >
                {dict.rules.rewrite}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setEditorOpen(false)}>
                {dict.common.cancel}
              </Button>
            )}
            {step === "describe" ? (
              <Button
                onClick={() => void handleInterpret()}
                disabled={interpreting || !utterance.trim()}
              >
                {dict.rules.interpret}
              </Button>
            ) : (
              <Button onClick={() => void handleSave()} disabled={saving}>
                {dict.rules.saveRule}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.rules.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>
              {dict.rules.deleteConfirmDescription}
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
                const result = await deleteRuleAction(deleteTarget.id)
                if (!result.ok) {
                  toast(result.error.message)
                  return
                }
                toast(dict.rules.deletedToast)
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
