"use server"

import { cookies } from "next/headers"

import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n"

export async function setLocaleAction(locale: Locale) {
  if (!isLocale(locale)) {
    return
  }

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
}
