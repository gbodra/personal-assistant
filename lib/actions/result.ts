export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL"

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: { code: ActionErrorCode; message: string }
    }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(
  code: ActionErrorCode,
  message: string
): ActionResult<never> {
  return { ok: false, error: { code, message } }
}
