/** New accounts are created only in local development against the shared Supabase. */
export function isSignupAllowed(): boolean {
  return process.env.NODE_ENV !== "production"
}
