import { LoginForm } from "@/features/auth/components/auth-forms"
import { getDictionary } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/get-locale"
import { isSignupAllowed } from "@/lib/security/signup"

export default async function LoginPage() {
  const locale = await getLocale()
  const dict = getDictionary(locale)

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-6">
      <div className="bg-background w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <div className="mb-6 space-y-1 text-center">
          <p className="text-lg font-semibold tracking-tight">{dict.app.name}</p>
          <h1 className="text-sm font-medium">{dict.auth.loginTitle}</h1>
        </div>
        <LoginForm dict={dict} showSignupLink={isSignupAllowed()} />
      </div>
    </div>
  )
}
