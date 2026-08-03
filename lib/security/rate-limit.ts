type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const MAX_BUCKETS = 10_000

function pruneIfNeeded(now: number) {
  if (buckets.size < MAX_BUCKETS) {
    return
  }

  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key)
    }
  }

  if (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value
    if (oldest !== undefined) {
      buckets.delete(oldest)
    }
  }
}

/** In-memory fixed window. Per-instance; resets on process restart / Render cold start. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now()
  pruneIfNeeded(now)

  const existing = buckets.get(key)
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterMs: existing.resetAt - now }
  }

  existing.count += 1
  return { allowed: true }
}

export const LOGIN_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 } as const
export const COMPILE_RATE_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 } as const
export const INSIGHTS_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 } as const
