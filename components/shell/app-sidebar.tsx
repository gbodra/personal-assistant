"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { Dictionary } from "@/lib/i18n"
import { visibleNavItems, type NavItem } from "@/lib/navigation/nav-items"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { UserMenu } from "@/components/shell/user-menu"

function labelFor(item: NavItem, dict: Dictionary) {
  return dict.nav[item.labelKey]
}

export function AppSidebar({
  dict,
  user,
}: {
  dict: Dictionary
  user: { name?: string | null; email?: string | null; image?: string | null }
}) {
  const pathname = usePathname()
  const items = visibleNavItems()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2 px-3 py-4">
        <Link href="/focus" className="flex items-center gap-2 px-1">
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg text-xs font-semibold">
            P
          </span>
          <span className="truncate font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            {dict.app.name}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((item) => item.id !== "settings")
                .map((item) => {
                  const Icon = item.icon
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={labelFor(item, dict)}
                        render={<Link href={item.href} />}
                      >
                        <Icon />
                        <span>{labelFor(item, dict)}</span>
                      </SidebarMenuButton>
                      {item.children && item.children.length > 0 ? (
                        <SidebarMenuSub>
                          {item.children.map((child) => {
                            const childActive = pathname === child.href
                            return (
                              <SidebarMenuSubItem key={child.id}>
                                <SidebarMenuSubButton
                                  isActive={childActive}
                                  render={<Link href={child.href} />}
                                >
                                  <span>{labelFor(child, dict)}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Separator className="mb-2" />
        <SidebarMenu>
          {items
            .filter((item) => item.id === "settings")
            .map((item) => {
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith("/settings")}
                    tooltip={labelFor(item, dict)}
                    render={<Link href={item.href} />}
                  >
                    <Icon />
                    <span>{labelFor(item, dict)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
        </SidebarMenu>
        <UserMenu dict={dict} user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
