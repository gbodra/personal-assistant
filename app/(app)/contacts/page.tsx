import { ContactsList } from "@/features/contacts/components/contacts-list"
import { listImportantContacts } from "@/features/contacts/data/contacts-repository"
import { requireUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/get-locale"

export default async function ContactsPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const contacts = await listImportantContacts(user.id)

  return <ContactsList contacts={contacts} dict={dict} />
}
