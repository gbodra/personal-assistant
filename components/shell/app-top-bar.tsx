import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function AppTopBar({
  title,
  scope,
  actions,
  className,
}: {
  title: string
  scope?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b px-4",
        className
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate text-sm font-semibold tracking-tight">
          {title}
        </h1>
        {scope}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  )
}
