import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"

export type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }
  return user
}
