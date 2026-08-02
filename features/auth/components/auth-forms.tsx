"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { loginAction, signupAction } from "@/features/auth/actions/auth"
import type { Dictionary } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export function LoginForm({
  dict,
  showSignupLink = false,
}: {
  dict: Dictionary
  showSignupLink?: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        setError(null)
        startTransition(async () => {
          const result = await loginAction({
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          })
          if (!result.ok) {
            setError(dict.auth.invalidCredentials)
            return
          }
          router.push("/focus")
          router.refresh()
        })
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">{dict.auth.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{dict.auth.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {dict.auth.login}
      </Button>
      {showSignupLink ? (
        <p className="text-muted-foreground text-center text-sm">
          {dict.auth.noAccount}{" "}
          <Link
            href="/signup"
            className="text-foreground underline-offset-4 hover:underline"
          >
            {dict.auth.signup}
          </Link>
        </p>
      ) : null}
    </form>
  )
}

export function SignupForm({ dict }: { dict: Dictionary }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        setError(null)
        startTransition(async () => {
          const result = await signupAction({
            name: String(form.get("name") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          })
          if (!result.ok) {
            if (result.error.message === "EMAIL_TAKEN") {
              setError(dict.auth.emailTaken)
            } else if (result.error.code === "VALIDATION") {
              setError(dict.auth.weakPassword)
            } else {
              setError(dict.common.error)
            }
            return
          }
          router.push("/focus")
          router.refresh()
        })
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">{dict.auth.name}</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{dict.auth.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{dict.auth.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {dict.auth.signup}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        {dict.auth.hasAccount}{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          {dict.auth.login}
        </Link>
      </p>
    </form>
  )
}
