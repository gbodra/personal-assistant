# PersonalOS

Open-source personal operating system. Start with **Daily Focus** (kanban) and grow into notes, calendar, habits, and integrations.

## Stack

- Next.js (App Router) + React 19
- Auth.js (NextAuth v5) — email/password
- Supabase Postgres
- Tailwind CSS 4 + shadcn/ui
- i18n: English + Portuguese

## Features (MVP)

- Auth: sign up / sign in with email and password
- Daily Focus board with lanes: To do, Doing, Done, Canceled
- Cards: title, description, tags, due date
- Drag and drop between lanes (desktop)
- Move via status select (mobile / accessibility)
- Done cards turn green; archive from Done
- Activity history stored in `app.activity_events`
- Settings: language (EN/PT) and theme
- Family directory (name + phone)
- WhatsApp message rules: natural-language compose, stored in Supabase for n8n classification
- Card priority (`critical` / `high` / `normal` / `low`)

## Setup

### 1. Install

```bash
pnpm install
```

### 2. Supabase

1. Create a Supabase project
2. In **SQL Editor**, run the migrations in order from [`supabase/migrations/`](supabase/migrations/)
3. **Expose custom schemas** (required): open [API Settings](https://supabase.com/dashboard/project/_/settings/api) → **Exposed schemas** and add `next_auth` and `app` (keep `public`)
4. Copy project URL, **publishable** key, **service role** key, and JWT secret

Without step 3, signup fails with `PGRST106 Invalid schema: next_auth`.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` locally |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (Settings → API Keys) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) |
| `SUPABASE_JWT_SECRET` | JWT secret (for RLS-ready tokens) |

### 4. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and use Daily Focus.

## Project structure

```
app/(app)/          # Authenticated shell routes
app/(auth)/         # Login / signup
features/kanban/    # Daily Focus domain, actions, UI
features/family/    # Family members directory
features/message-rules/ # WhatsApp prioritization rules (NL → structured)
features/auth/      # Auth forms and locale action
lib/auth/           # Auth.js config
lib/supabase/       # Server Supabase clients
lib/navigation/     # Module nav registry
lib/events/         # In-process domain event bus
integrations/       # External adapters + n8n WhatsApp contract
supabase/migrations/
```

## Adding a new module

1. Create `features/<name>/` with domain, data, actions, components
2. Add a route under `app/(app)/`
3. Register the module in [`lib/navigation/nav-items.ts`](lib/navigation/nav-items.ts)
4. Add a Supabase migration if you need new tables
5. Emit domain events via `lib/events` when other modules should react

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

## License

MIT (or choose your preferred open-source license).
