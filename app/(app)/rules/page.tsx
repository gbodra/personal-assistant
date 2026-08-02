import { RulesList } from "@/features/message-rules/components/rules-list"
import { listMessageRules } from "@/features/message-rules/data/rules-repository"
import { listFamilyMembers } from "@/features/family/data/family-repository"
import { requireUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/get-locale"

export default async function RulesPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const [rules, family] = await Promise.all([
    listMessageRules(user.id),
    listFamilyMembers(user.id),
  ])

  return (
    <RulesList
      rules={rules}
      dict={dict}
      familyCount={family.length}
      locale={locale}
    />
  )
}
