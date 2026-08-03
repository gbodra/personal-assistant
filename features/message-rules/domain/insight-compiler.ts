import {
  llmInsightsResponseSchema,
  MAX_INSIGHTS,
  type InboxEvidenceItem,
  type RuleInsight,
} from "@/features/message-rules/domain/insights"

export type InsightCompilerContext = {
  existingRuleSummaries: string[]
}

function evidenceClusterKey(item: InboxEvidenceItem): string {
  if (item.contactGroup) return `list:${item.contactGroup}`
  if (item.groupName) return `group:${item.groupName}`
  if (item.groupId) return `groupId:${item.groupId}`
  if (item.contactName) return `contact:${item.contactName}`
  if (item.from) return `from:${item.from}`
  const prefix = item.title.split(/\s+/).slice(0, 3).join(" ").toLowerCase()
  return `title:${prefix || "misc"}`
}

function heuristicInsights(
  evidence: InboxEvidenceItem[],
  context: InsightCompilerContext
): RuleInsight[] {
  if (evidence.length === 0) return []

  const clusters = new Map<string, InboxEvidenceItem[]>()
  for (const item of evidence) {
    const key = evidenceClusterKey(item)
    const bucket = clusters.get(key) ?? []
    bucket.push(item)
    clusters.set(key, bucket)
  }

  const existingLower = context.existingRuleSummaries.map((s) => s.toLowerCase())

  const sorted = [...clusters.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )

  const insights: RuleInsight[] = []
  for (const [key, items] of sorted) {
    if (insights.length >= MAX_INSIGHTS) break

    const sample = items[0]
    let title: string
    let utterance: string
    let rationale: string

    if (key.startsWith("list:")) {
      const group = key.slice(5)
      title = `Mensagens de ${group}`
      utterance = `Quando for mensagem de ${group}, criar card com prioridade normal e tag ${group}`
      rationale = `${items.length} mensagens na Inbox parecem vir do diretório ${group}.`
    } else if (key.startsWith("group:") || key.startsWith("groupId:")) {
      const name = sample.groupName ?? "grupo do WhatsApp"
      title = `Grupo ${name}`
      utterance = `Quando mensagem no grupo "${name}", criar card com prioridade normal`
      rationale = `${items.length} mensagens na Inbox vieram desse grupo.`
    } else if (key.startsWith("contact:")) {
      const name = sample.contactName ?? "contato"
      title = `De ${name}`
      utterance = `Quando mensagem de "${name}", criar card com prioridade normal`
      rationale = `${items.length} mensagens na Inbox de ${name}.`
    } else if (key.startsWith("from:")) {
      title = "Remetente recorrente"
      utterance =
        "Quando mensagens promocionais ou spam de remetentes desconhecidos, ignorar"
      rationale = `${items.length} mensagens na Inbox sem contato cadastrado — possível padrão de spam.`
    } else {
      title = "Padrão na Inbox"
      utterance = `Quando mensagens parecidas com "${sample.title}", criar card com prioridade normal`
      rationale = `${items.length} cards na Inbox compartilham um padrão de título.`
    }

    if (
      existingLower.some(
        (summary) =>
          summary.includes(title.toLowerCase()) ||
          utterance.toLowerCase().includes(summary.slice(0, 40))
      )
    ) {
      continue
    }

    insights.push({
      id: crypto.randomUUID(),
      title,
      rationale,
      suggestedUtterance: utterance,
      sampleCardIds: items.slice(0, 5).map((item) => item.cardId),
      estimatedCoverage: items.length,
    })
  }

  return insights
}

function toPromptEvidence(evidence: InboxEvidenceItem[]) {
  return evidence.map((item) => ({
    cardId: item.cardId,
    title: item.title,
    description: item.description,
    contactName: item.contactName,
    contactGroup: item.contactGroup,
    groupName: item.groupName,
    isGroup: item.isGroup,
    wasMentioned: item.wasMentioned,
    messageType: item.messageType,
    message: item.message,
  }))
}

async function llmInsights(
  evidence: InboxEvidenceItem[],
  context: InsightCompilerContext,
  apiKey: string
): Promise<RuleInsight[]> {
  const system = `You analyze unmatched WhatsApp Inbox cards and suggest message-prioritization rules.
Return ONLY valid JSON:
{
  "insights": [
    {
      "title": string (short headline, max 80 chars),
      "rationale": string (1-2 sentences why this pattern),
      "suggestedUtterance": string (natural-language rule the user would type to create a rule — Portuguese if evidence looks PT),
      "sampleCardIds": string[] (up to 5 cardIds from the evidence that inspired this),
      "estimatedCoverage": number (how many of the analyzed cards this might cover)
    }
  ]
}
Rules for suggestions:
- Suggest at most ${MAX_INSIGHTS} insights, preferring high-coverage patterns.
- suggestedUtterance must be actionable: who/when + what to do (create card with priority/tags OR ignore).
- Do NOT duplicate existing rules.
- Do NOT invent phone numbers or group ids not in the evidence.
- Prefer ignore for clear promo/spam clusters; create for personal/work/family patterns.
- sampleCardIds must be real cardIds from the evidence.
Existing rules: ${JSON.stringify(context.existingRuleSummaries)}`

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
        {
          role: "user",
          content: JSON.stringify({
            evidence: toPromptEvidence(evidence),
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM_INSIGHTS_FAILED:${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new Error("LLM_INSIGHTS_EMPTY")
  }

  const parsed = llmInsightsResponseSchema.parse(JSON.parse(content))
  const knownIds = new Set(evidence.map((item) => item.cardId))

  return parsed.insights.map((insight) => ({
    id: crypto.randomUUID(),
    title: insight.title,
    rationale: insight.rationale,
    suggestedUtterance: insight.suggestedUtterance,
    sampleCardIds: insight.sampleCardIds.filter((id) => knownIds.has(id)).slice(0, 5),
    estimatedCoverage: Math.min(
      insight.estimatedCoverage || insight.sampleCardIds.length,
      evidence.length
    ),
  }))
}

export async function compileInboxInsights(
  evidence: InboxEvidenceItem[],
  context: InsightCompilerContext
): Promise<RuleInsight[]> {
  if (evidence.length === 0) return []

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (apiKey) {
    try {
      return await llmInsights(evidence, context, apiKey)
    } catch {
      // Fall back to heuristic if LLM fails
    }
  }

  return heuristicInsights(evidence, context)
}
