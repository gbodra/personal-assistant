import { FocusBoard } from "@/features/kanban/components/focus-board"
import { ensureDefaultBoard } from "@/features/kanban/data/board-repository"
import { requireUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/get-locale"

export default async function FocusPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const board = await ensureDefaultBoard(user.id)

  return <FocusBoard initialBoard={board} dict={dict} />
}
