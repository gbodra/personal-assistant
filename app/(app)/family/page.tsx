import { FamilyList } from "@/features/family/components/family-list"
import { listFamilyMembers } from "@/features/family/data/family-repository"
import { requireUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/get-locale"

export default async function FamilyPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const members = await listFamilyMembers(user.id)

  return <FamilyList members={members} dict={dict} />
}
