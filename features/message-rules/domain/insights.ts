import { z } from "zod"

export const INBOX_EVIDENCE_LIMIT = 20
export const MAX_INSIGHTS = 5
export const TITLE_TRUNCATE = 200
export const TEXT_TRUNCATE = 500

export type InboxEvidenceItem = {
  cardId: string
  title: string
  description: string | null
  createdAt: string
  contactName: string | null
  contactGroup: string | null
  groupName: string | null
  from: string | null
  participant: string | null
  isGroup: boolean | null
  groupId: string | null
  wasMentioned: boolean | null
  messageType: string | null
  message: string | null
}

export const ruleInsightSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(1).max(500),
  suggestedUtterance: z.string().trim().min(1).max(4000),
  sampleCardIds: z.array(z.string()).max(5),
  estimatedCoverage: z.number().int().min(0),
})

export type RuleInsight = z.infer<typeof ruleInsightSchema>

export const llmInsightsResponseSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        rationale: z.string().trim().min(1).max(500),
        suggestedUtterance: z.string().trim().min(1).max(4000),
        sampleCardIds: z.array(z.string()).max(5).default([]),
        estimatedCoverage: z.number().int().min(0).default(0),
      })
    )
    .max(MAX_INSIGHTS),
})

export function truncateText(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}
