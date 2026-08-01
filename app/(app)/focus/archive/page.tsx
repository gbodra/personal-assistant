import { ArchiveList } from "@/features/kanban/components/archive-list"
import { getArchivedCards } from "@/features/kanban/data/board-repository"
import { requireUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/get-locale"

export default async function ArchivePage() {
  const user = await requireUser()
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const cards = await getArchivedCards(user.id)

  return <ArchiveList cards={cards} dict={dict} />
}
