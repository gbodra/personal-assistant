# PersonalOS

Open-source personal operating system. Start with **Daily Focus** (kanban) and grow into notes, calendar, habits, and integrations.

## Stack

- Next.js (App Router) + React 19
- Auth.js (NextAuth v5) — email/password
- Supabase Postgres
- Tailwind CSS 4 + shadcn/ui
- i18n: English + Portuguese

## Features (MVP)

- Auth: sign in with email and password (signup only in local development)
- Daily Focus board with lanes: To do, Doing, Done, Canceled
- Cards: title, description, tags, due date
- Drag and drop between lanes (desktop)
- Move via status select (mobile / accessibility)
- Done cards turn green; archive from Done
- Activity history stored in `app.activity_events`
- Settings: language (EN/PT) and theme
- Important contacts directory (partners / family / clients — name + phone + group)
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
4. Copy project URL, **publishable** key, and **service role** key

Without step 3, signup fails with `PGRST106 Invalid schema: next_auth`.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` locally; production URL on Render |
| `AUTH_TRUST_HOST` | `true` (needed on Render) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (Settings → API Keys) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (**server only** — never `NEXT_PUBLIC_`) |
| `SUPABASE_JWT_SECRET` | Optional; reserved for a future JWT+RLS path |
| `OPENAI_API_KEY` | Optional; NL rule compile (falls back to heuristics) |

### 4. Run (and create accounts)

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). **Signup is only available in development** (`NODE_ENV !== production`). Create accounts via `/signup` locally against the same Supabase project you use in production. On Render, `/signup` redirects to login and `signupAction` is denied.

## Deploy on Render

1. Create a **Web Service** from this repo (Node). Build: `pnpm install && pnpm build`. Start: `pnpm start`.
2. Set env vars from the table above. Use a strong unique `AUTH_SECRET`. Set `AUTH_URL` to `https://<your-service>.onrender.com` (or custom domain).
3. Keep `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` as **secret** env vars (not public).
4. Confirm Supabase schemas `app` and `next_auth` are exposed.
5. If using n8n/WhatsApp: store `service_role` only in n8n credentials; every `messages_received` insert **must** set `user_id` (column is `NOT NULL`). See [`integrations/whatsapp-n8n/README.md`](integrations/whatsapp-n8n/README.md).
6. Login attempts and rule compile are rate-limited in-memory (per instance; resets on cold start).

## Project structure

```
app/(app)/          # Authenticated shell routes
app/(auth)/         # Login / signup
features/kanban/    # Daily Focus domain, actions, UI
features/contacts/  # Important contacts directory (partners / family / clients)
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
