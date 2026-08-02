"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseRealtimeTokenAction } from "@/features/kanban/actions/realtime"
import { createClient } from "@/lib/supabase/client"

const REFRESH_DEBOUNCE_MS = 300
const TOKEN_REFRESH_MARGIN_MS = 60_000

function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
  if (timer) {
    clearTimeout(timer)
  }
}

function tokenRefreshDelayMs(expiresAt: number) {
  return Math.max(expiresAt * 1000 - Date.now() - TOKEN_REFRESH_MARGIN_MS, 5_000)
}

async function fetchAndSetRealtimeAuth(supabase: SupabaseClient) {
  const result = await getSupabaseRealtimeTokenAction()
  if (!result.ok) {
    return null
  }
  await supabase.realtime.setAuth(result.data.accessToken)
  return result.data.expiresAt
}

function subscribeCardsInsert(
  supabase: SupabaseClient,
  boardId: string,
  onInsert: () => void
): RealtimeChannel {
  return supabase
    .channel(`cards:${boardId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "app",
        table: "cards",
        filter: `board_id=eq.${boardId}`,
      },
      onInsert
    )
    .subscribe()
}

export function useCardsRealtime(boardId: string) {
  const router = useRouter()
  const boardRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  useEffect(() => {
    let cancelled = false
    let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null
    let channel: RealtimeChannel | null = null
    const supabase = createClient()

    const refreshBoard = () => {
      router.refresh()
    }

    const onCardInsert = () => {
      clearTimer(boardRefreshTimerRef.current)
      boardRefreshTimerRef.current = setTimeout(
        refreshBoard,
        REFRESH_DEBOUNCE_MS
      )
    }

    const refreshAuth = async () => {
      if (cancelled) {
        return
      }
      const expiresAt = await fetchAndSetRealtimeAuth(supabase)
      if (cancelled || expiresAt === null) {
        return
      }
      clearTimer(tokenRefreshTimer)
      tokenRefreshTimer = setTimeout(runTokenRefresh, tokenRefreshDelayMs(expiresAt))
    }

    const runTokenRefresh = () => {
      refreshAuth().catch(ignoreAsyncError)
    }

    const connect = async () => {
      const expiresAt = await fetchAndSetRealtimeAuth(supabase)
      if (cancelled || expiresAt === null) {
        return
      }

      channel = subscribeCardsInsert(supabase, boardId, onCardInsert)
      clearTimer(tokenRefreshTimer)
      tokenRefreshTimer = setTimeout(runTokenRefresh, tokenRefreshDelayMs(expiresAt))
    }

    connect().catch(ignoreAsyncError)

    return () => {
      cancelled = true
      clearTimer(boardRefreshTimerRef.current)
      boardRefreshTimerRef.current = null
      clearTimer(tokenRefreshTimer)
      if (channel) {
        supabase.removeChannel(channel).catch(ignoreAsyncError)
      }
    }
  }, [boardId, router])
}

function ignoreAsyncError() {
  /* subscription lifecycle errors are non-fatal */
}
