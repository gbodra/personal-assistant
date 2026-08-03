"use client"

import { RefreshCw } from "lucide-react"

import type { RuleInsight } from "@/features/message-rules/domain/insights"
import type { Dictionary } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type InsightsStatus = "idle" | "loading" | "ready" | "error"

export function InboxInsightsPanel({
  inboxCount,
  dict,
  status,
  insights,
  errorMessage,
  onAnalyze,
  onUseInsight,
}: Readonly<{
  inboxCount: number
  dict: Dictionary
  status: InsightsStatus
  insights: RuleInsight[]
  errorMessage: string | null
  onAnalyze: () => void
  onUseInsight: (insight: RuleInsight) => void
}>) {
  if (inboxCount <= 0) return null

  return (
    <section className="bg-card mb-4 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{dict.rules.insightsTitle}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {dict.rules.insightsHint}
          </p>
        </div>
        {status === "ready" || status === "error" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onAnalyze}
            aria-label={dict.rules.insightsRetry}
          >
            <RefreshCw />
          </Button>
        ) : null}
      </div>

      {status === "idle" ? (
        <div className="mt-3">
          <Button type="button" variant="outline" size="sm" onClick={onAnalyze}>
            {dict.rules.insightsAnalyze}
          </Button>
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="mt-3 space-y-2">
          <p className="text-muted-foreground text-sm">
            {dict.rules.insightsLoading}
          </p>
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="border-destructive/30 bg-destructive/5 mt-3 rounded-lg border p-3">
          <p className="text-destructive text-sm">
            {errorMessage ?? dict.rules.insightsError}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onAnalyze}
          >
            {dict.rules.insightsRetry}
          </Button>
        </div>
      ) : null}

      {status === "ready" && insights.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">
          {dict.rules.insightsEmptyResult}
        </p>
      ) : null}

      {status === "ready" && insights.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {insights.map((insight) => (
            <li
              key={insight.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{insight.title}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {insight.rationale}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {dict.rules.insightsEvidence.replace(
                    "{count}",
                    String(insight.estimatedCoverage)
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => onUseInsight(insight)}
              >
                {dict.rules.insightsUse}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
