import type { LucideIcon } from "lucide-react"
import { Focus, ListFilter, Settings, Users } from "lucide-react"

export type NavStage = "ga" | "beta" | "hidden"

export type NavItem = {
  id: string
  labelKey: "focus" | "board" | "archive" | "family" | "rules" | "settings"
  href: string
  icon: LucideIcon
  stage: NavStage
  children?: NavItem[]
}

export const navItems: NavItem[] = [
  {
    id: "focus",
    labelKey: "focus",
    href: "/focus",
    icon: Focus,
    stage: "ga",
  },
  {
    id: "family",
    labelKey: "family",
    href: "/family",
    icon: Users,
    stage: "ga",
  },
  {
    id: "rules",
    labelKey: "rules",
    href: "/rules",
    icon: ListFilter,
    stage: "ga",
  },
  {
    id: "settings",
    labelKey: "settings",
    href: "/settings",
    icon: Settings,
    stage: "ga",
  },
]

export function visibleNavItems(items: NavItem[] = navItems): NavItem[] {
  return items
    .filter((item) => item.stage !== "hidden")
    .map((item) => ({
      ...item,
      children: item.children
        ? visibleNavItems(item.children)
        : undefined,
    }))
}
