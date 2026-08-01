"use client"

import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"

import { setLocaleAction } from "@/features/auth/actions/locale"
import type { Dictionary, Locale } from "@/lib/i18n"
import { locales } from "@/lib/i18n"
import { AppTopBar } from "@/components/shell/app-top-bar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function SettingsForm({
  dict,
  locale,
  user,
}: {
  dict: Dictionary
  locale: Locale
  user: { name?: string | null; email?: string | null }
}) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AppTopBar title={dict.settings.title} />
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8 p-6">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">{dict.settings.account}</h2>
            <p className="text-muted-foreground text-sm">
              {user.name} · {user.email}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <Label>{dict.settings.language}</Label>
            <p className="text-muted-foreground text-sm">
              {dict.settings.languageHint}
            </p>
          </div>
          <div className="flex gap-2">
            {locales.map((item) => (
              <Button
                key={item}
                variant={locale === item ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  await setLocaleAction(item)
                  router.refresh()
                }}
              >
                {item.toUpperCase()}
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <Label>{dict.settings.theme}</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={theme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("system")}
            >
              {dict.settings.themeSystem}
            </Button>
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
            >
              {dict.settings.themeLight}
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
            >
              {dict.settings.themeDark}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
