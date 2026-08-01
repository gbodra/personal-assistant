import { cookies } from "next/headers"

import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./types"

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const value = cookieStore.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : defaultLocale
}
