import { listImportantContacts } from "@/features/contacts/data/contacts-repository"
import { CONTACT_GROUPS } from "@/features/contacts/domain/types"
import { RulesList } from "@/features/message-rules/components/rules-list"
import { listMessageRules } from "@/features/message-rules/data/rules-repository"
import type { ContactList } from "@/features/message-rules/domain/types"
import { requireUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/get-locale"

export default async function RulesPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const [rules, contacts] = await Promise.all([
    listMessageRules(user.id),
    listImportantContacts(user.id),
  ])

  const contactCounts = Object.fromEntries(
    CONTACT_GROUPS.map((group) => [group, 0])
  ) as Record<ContactList, number>

  for (const contact of contacts) {
    contactCounts[contact.contactGroup] += 1
  }

  return (
    <RulesList
      rules={rules}
      dict={dict}
      contactCounts={contactCounts}
      locale={locale}
    />
  )
}
