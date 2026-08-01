import { SettingsForm } from "@/features/auth/components/settings-form"
import { requireUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/get-locale"

export default async function SettingsPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const dict = getDictionary(locale)

  return <SettingsForm dict={dict} locale={locale} user={user} />
}
