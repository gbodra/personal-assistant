/** Strip non-digits for phone matching (aligned with app.normalize_phone). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "")
}
