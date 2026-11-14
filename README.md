# Hisab

Personal finance management SaaS — track income, expenses, monthly
budgets, and spending trends. Built with Next.js (App Router),
TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth), and
Recharts. Default currency: INR (₹).

> **Status (14 Nov 2026):** the full application is built and the
> production build passes. A live Supabase connection is **blocked** —
> no Supabase credentials have been supplied yet, so auth, data
> persistence, and the two-user RLS tests have not been run against a
> real project. See [Supabase setup](#supabase-setup) for the exact
> steps that unblock them.

## Features

- **Auth** — email/password signup, login, email verification,
  forgot/reset password, logout, protected routes (server-validated
  sessions), profile edit, account deletion with confirmation.
- **Dashboard** — income/expense/net/savings-rate summary cards,
  income-vs-expense and category charts, spending + savings trends,
  recent transactions, monthly budget progress, quick-add.
- **Transactions** — full CRUD, search, filters (type, category,
  payment method, date range), sort, server-side pagination.
- **Budgets** — monthly per-category budgets, spent/remaining,
  utilisation %, 80% warning, 100% exceeded state.
- **Analytics** — weekly / monthly / yearly / custom ranges,
  previous-period comparison, category breakdown, averages.
- **Categories** — 16 seeded system categories + custom categories
  (system ones cannot be edited or deleted; referenced custom
  categories cannot be deleted).
- **Settings** — name, avatar URL, currency (INR, display-only),
  date format, dark/light theme, password update, data export,
  delete account.
- **CSV** — import with preview, per-row validation reasons and
  deterministic deduplication; export respects active filters.

## Tech stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Framework    | Next.js 16 (App Router, `cacheComponents`) |
| Language     | TypeScript (strict)                     |
| Styling      | Tailwind CSS v4, shadcn/ui              |
| Backend      | Supabase (PostgreSQL + Auth, `@supabase/ssr`) |
| Charts       | Recharts                                |
| Icons        | Lucide React                            |
| Forms        | React Hook Form + Zod                   |
| Tests        | Vitest                                  |
| Deployment   | Netlify (Next.js runtime)               |

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase values (below)
npm run dev                  # http://localhost:3000
```

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Start the dev server                  |
| `npm run build`   | Production build                      |
| `npm run start`   | Serve the production build            |
| `npm run lint`    | ESLint                                |
| `npm run typecheck` | `tsc --noEmit`                      |
| `npm run test`    | Vitest unit tests (financial logic)   |

## Supabase setup

1. **Create a Supabase project** named `hisab` at
   https://supabase.com/dashboard (free tier is enough).
2. **Copy the credentials** — Project Settings → API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (or legacy anon key) →
     `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. **Set them locally** in `.env.local` (see `.env.example`).
4. **Configure Auth redirects** — Authentication → URL Configuration:
   - Site URL: `http://localhost:3000` (local) and later your
     Netlify production URL.
   - Redirect URLs: add
     `http://localhost:3000/auth/callback` and
     `https://<your-site>.netlify.app/auth/callback`.
   - Keep **email confirmations** enabled (default on new projects)
     so the verification step is enforced.
5. **Apply the migration** — either with the Supabase CLI:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   or paste `supabase/migrations/20261114000001_init.sql` into the
   SQL editor and run it. The migration creates all tables, indexes,
   constraints, triggers, RLS policies, and seeds the 16 system
   categories.
6. **Verify** — sign up in the app, create a transaction, and confirm
   it persists after refresh and re-login.

### RLS two-user test (run after setup)

1. Create two accounts, User A and User B.
2. As A: create a transaction and a budget. As B: confirm neither is
   visible, and that B cannot update/delete A's records (attempts must
   fail or return no rows).
3. Attempt an insert as A with `user_id` set to B's id (via the
   Supabase client in the browser console) — the RLS `WITH CHECK`
   policy must reject it.
4. Attempt a transaction as A referencing B's private category — the
   database validation trigger must reject it.
5. Repeat as B. Record the results in `DEVLOG.md`.

## Netlify deployment

No Netlify credentials are available to the build agent, so deployment
is a manual step. Exact procedure:

1. Push this repo to GitHub (`sushilbyte7/hisab` — create the repo on
   github.com first; the GitHub connector cannot create repos).
2. In Netlify: **Add new site → Import an existing project → GitHub**,
   pick the repo. Netlify auto-detects Next.js (OpenNext runtime) —
   do **not** force a static export and do **not** add a SPA catch-all
   rewrite; the app needs SSR, auth, and server actions.
3. Build settings: build command `npm run build`, publish directory
   left to the Next.js runtime (do not override).
4. Environment variables (Site settings → Environment variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - No service-role key is used anywhere in this app.
5. Trigger a deploy. After the first successful deploy, update the
   Supabase Auth Site URL and redirect URLs to the production domain
   (see step 4 above).
6. Smoke-test on the production URL: signup → email verification →
   login → create/edit/delete a transaction → refresh (data persists)
   → budgets, analytics, CSV export → mobile layout → no console
   errors.

## Project structure

```text
hisab/
├── src/
│   ├── app/
│   │   ├── (auth)/login, signup, forgot-password, reset-password
│   │   ├── (dashboard)/dashboard, transactions, budgets,
│   │   │                 analytics, categories, settings
│   │   ├── auth/callback/          # Supabase email-link handler
│   │   └── api/                    # Route handlers (CSV export, account delete)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── dashboard/, transactions/, budgets/,
│   │   ├── analytics/, categories/, settings/, layout/
│   ├── lib/
│   │   ├── supabase/               # browser/server/proxy clients
│   │   ├── validations/            # Zod schemas
│   │   ├── finance.ts              # paise-exact money math
│   │   ├── csv.ts                  # CSV parse/validate/dedup/export
│   │   └── utils.ts
│   ├── services/                   # server-side data access per domain
│   ├── hooks/
│   └── types/database.ts           # DB types (match the migration)
├── supabase/
│   ├── migrations/20261114000001_init.sql
│   └── seed.sql                    # re-runnable system-category seed
├── tests/                          # Vitest unit tests
├── .env.example
├── DEVLOG.md
└── README.md
```

## Security notes

- RLS is enabled on **every** table; policies restrict rows to
  `auth.uid()`. System categories are readable by all authenticated
  users but mutable by nobody.
- Category ownership/type is validated by database triggers, not only
  in the UI — a spoofed category reference fails server-side.
- `user_id` is never trusted from client input; server actions derive
  it from the authenticated session.
- No service-role/secret key exists in this repo, in client bundles,
  or in logs. Only the two `NEXT_PUBLIC_` variables are used.
- Amounts are `NUMERIC(12,2)` in Postgres; app-side math uses integer
  paise (see `src/lib/finance.ts`).

## Known limitations

- Live Supabase connection, remote migration run, and the two-user
  RLS tests are **blocked** on credentials (see status above).
- No Netlify site exists yet — deployment is manual (see above).
- Currency is display-only in the MVP (INR default); no conversion.
- Avatar is a URL field (no file upload/storage bucket in the MVP).
- Account deletion: the app explicitly deletes the user's data in
  dependency order (transactions → budgets → custom categories →
  profile row) and then signs the user out. Note the profile row has
  no dependents — the tables' foreign keys point at `auth.users`, so
  deleting the profile row alone would cascade nothing. Deleting the
  Supabase Auth user itself requires a service-role key on a trusted
  server, which this MVP deliberately does not ship — after deleting
  their data in-app, the user can ask a project admin to remove the
  auth user from the Supabase dashboard (Authentication → Users), or
  re-use the same email to sign up again (the profile trigger
  recreates the profile row).
