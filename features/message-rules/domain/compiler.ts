import { messageRuleDraftSchema } from "@/features/message-rules/domain/schema"
import { normalizePhone } from "@/features/message-rules/domain/phone"
import type {
  MessageRuleDraft,
  Priority,
  RuleActions,
  RuleCondition,
} from "@/features/message-rules/domain/types"

export type RuleCompilerContext = {
  familyNames: string[]
  partnerNames: string[]
  groupNames: { name: string; externalGroupId: string }[]
}

export interface RuleCompiler {
  compile(
    utterance: string,
    context: RuleCompilerContext
  ): Promise<MessageRuleDraft>
}

function detectPriority(text: string): Priority {
  const lower = text.toLowerCase()
  if (
    /\b(cr[ií]tic[oa]|urgent[ei]|p0|prioridade\s*cr[ií]tica)\b/.test(lower)
  ) {
    return "critical"
  }
  if (/\b(alta|high|p1|prioridade\s*alta)\b/.test(lower)) {
    return "high"
  }
  if (/\b(baixa|low|p3|prioridade\s*baixa)\b/.test(lower)) {
    return "low"
  }
  return "normal"
}

function extractQuotedOrAfter(
  text: string,
  patterns: RegExp[]
): string[] {
  const found: string[] = []
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const value = (match[1] ?? "").trim()
      if (value) found.push(value)
    }
  }
  return found
}

function heuristicCompile(
  utterance: string,
  context: RuleCompilerContext
): MessageRuleDraft {
  const text = utterance.trim()
  const lower = text.toLowerCase()
  const warnings: string[] = []
  const conditions: RuleCondition[] = []
  let isCatchAll = false

  const wantsIgnore =
    /\b(ignor[ae]r?|ignore|spam|promo[cç][oõ]es?|n[aã]o\s+criar|sem\s+card)\b/.test(
      lower
    )

  if (/\b(fam[ií]lia|familiares|family)\b/.test(lower)) {
    conditions.push({ type: "from_list", list: "family" })
  }

  if (/\b(parceiros?|partners?|neg[oó]cios?|business)\b/.test(lower)) {
    conditions.push({ type: "from_list", list: "partners" })
  }

  if (/\b(mencionad[oa]|mentioned|me\s+marcou)\b/.test(lower)) {
    conditions.push({ type: "was_mentioned" })
  }

  const groupHints = extractQuotedOrAfter(text, [
    /grupo\s+[“"']([^“"']+)[”"']/gi,
    /grupo\s+([A-Za-zÀ-ÿ0-9][\wÀ-ÿ\s-]{1,40})/gi,
    /group\s+[“"']([^“"']+)[”"']/gi,
  ])

  for (const hint of groupHints) {
    const known = context.groupNames.find(
      (g) => g.name.toLowerCase() === hint.toLowerCase()
    )
    if (known) {
      conditions.push({
        type: "in_groups",
        group_ids: [known.externalGroupId],
      })
    } else {
      conditions.push({ type: "in_groups", group_ids: [hint] })
      warnings.push(`Group "${hint}" not in saved groups — using as id/label.`)
    }
  }

  const keywords = extractQuotedOrAfter(text, [
    /tema[s]?\s+[“"']([^“"']+)[”"']/gi,
    /cont[eé]m\s+[“"']([^“"']+)[”"']/gi,
    /keyword[s]?\s+[“"']([^“"']+)[”"']/gi,
    /sobre\s+[“"']([^“"']+)[”"']/gi,
  ])
  if (keywords.length > 0) {
    conditions.push({
      type: "keyword_any",
      keywords,
      case_sensitive: false,
    })
  }

  const phoneMatches = text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []
  const phones = phoneMatches.map(normalizePhone).filter((p) => p.length >= 8)
  if (phones.length > 0) {
    conditions.push({ type: "from_phones", phones })
  }

  if (
    conditions.length === 0 &&
    /\b(todas?|qualquer|all\s+messages?|catch[- ]?all|demais)\b/.test(lower)
  ) {
    isCatchAll = true
  }

  if (conditions.length === 0 && !isCatchAll && !wantsIgnore) {
    warnings.push("Could not detect a clear condition — review Quando.")
  }

  if (conditions.length === 0 && !isCatchAll && wantsIgnore) {
    warnings.push("Ignore without condition — confirm if this is catch-all.")
  }

  let actions: RuleActions
  if (wantsIgnore) {
    actions = { disposition: "ignore" }
  } else {
    const tagNames = extractQuotedOrAfter(text, [
      /tag[s]?\s+[“"']([^“"']+)[”"']/gi,
      /tag[s]?\s+(\w[\w-]{0,39})/gi,
    ])
    if (/\bfam[ií]lia\b/.test(lower) && !tagNames.includes("família")) {
      tagNames.push("família")
    }
    if (/\bparceiro/.test(lower) && !tagNames.some((t) => /parceiro/i.test(t))) {
      tagNames.push("parceiro")
    }
    actions = {
      disposition: "create",
      priority: detectPriority(lower),
      tag_ids: [],
      tag_names: [...new Set(tagNames)],
      lane_key: "todo",
    }
  }

  if (!wantsIgnore && !/\b(criar|create|card|foco|focus|prioridade|priority|tag)\b/.test(lower)) {
    warnings.push("Action inferred as create — confirm Então.")
  }

  const name =
    text.length > 60 ? `${text.slice(0, 57).trim()}…` : text || "Nova regra"

  const draft: MessageRuleDraft = {
    name,
    conditions: isCatchAll ? [] : conditions,
    actions,
    isCatchAll,
    sourceUtterance: text,
    tagNames:
      actions.disposition === "create" ? (actions.tag_names ?? []) : [],
    warnings,
  }

  return messageRuleDraftSchema.parse(draft)
}

async function llmCompile(
  utterance: string,
  context: RuleCompilerContext,
  apiKey: string
): Promise<MessageRuleDraft> {
  const system = `You compile WhatsApp message prioritization rules into JSON schema_version 1.
Return ONLY valid JSON matching:
{
  "name": string,
  "isCatchAll": boolean,
  "conditions": RuleCondition[],
  "actions": { "disposition":"create","priority":"critical"|"high"|"normal"|"low","tag_names":string[] }
            | { "disposition":"ignore" },
  "warnings": string[]
}
Condition types: from_list (family|partners), from_phones, in_groups (use external_group_id when known), was_mentioned, message_type, keyword_any, keyword_all.
Actions must be explicit. If ignore, no priority/tags. Prefer Portuguese tag names when utterance is PT.
Known groups: ${JSON.stringify(context.groupNames)}
Family names: ${JSON.stringify(context.familyNames)}
Partner names: ${JSON.stringify(context.partnerNames)}`

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: utterance },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM_COMPILE_FAILED:${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new Error("LLM_COMPILE_EMPTY")
  }

  const parsed = JSON.parse(content) as {
    name?: string
    isCatchAll?: boolean
    conditions?: RuleCondition[]
    actions?: RuleActions & { tag_names?: string[] }
    warnings?: string[]
  }

  const tagNames =
    parsed.actions && parsed.actions.disposition === "create"
      ? (parsed.actions.tag_names ?? [])
      : []

  const actions: RuleActions =
    parsed.actions?.disposition === "ignore"
      ? { disposition: "ignore" }
      : {
          disposition: "create",
          priority:
            parsed.actions && parsed.actions.disposition === "create"
              ? parsed.actions.priority
              : "normal",
          tag_ids: [],
          tag_names: tagNames,
          lane_key: "todo",
        }

  const draft: MessageRuleDraft = {
    name: parsed.name?.trim() || utterance.slice(0, 60),
    conditions: parsed.isCatchAll ? [] : (parsed.conditions ?? []),
    actions,
    isCatchAll: Boolean(parsed.isCatchAll),
    sourceUtterance: utterance.trim(),
    tagNames,
    warnings: parsed.warnings ?? [],
  }

  return messageRuleDraftSchema.parse(draft)
}

export class DefaultRuleCompiler implements RuleCompiler {
  async compile(
    utterance: string,
    context: RuleCompilerContext
  ): Promise<MessageRuleDraft> {
    const trimmed = utterance.trim()
    if (!trimmed) {
      throw new Error("EMPTY_UTTERANCE")
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (apiKey) {
      try {
        return await llmCompile(trimmed, context, apiKey)
      } catch {
        // Fall back to heuristic if LLM fails
      }
    }

    return heuristicCompile(trimmed, context)
  }
}

export const ruleCompiler: RuleCompiler = new DefaultRuleCompiler()
