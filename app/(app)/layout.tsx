import { AppSidebar } from "@/components/shell/app-sidebar"
import { AuthSessionProvider } from "@/components/providers/session-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/get-locale"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  const locale = await getLocale()
  const dict = getDictionary(locale)

  return (
    <AuthSessionProvider>
      <SidebarProvider>
        <AppSidebar dict={dict} user={user} />
        <SidebarInset className="min-h-svh overflow-hidden">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </AuthSessionProvider>
  )
}
