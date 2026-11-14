# Hisab — Development Log

Concise build record. Statuses: **Passed / Failed / Not tested / Blocked**.

## 2026-11-14 — Foundation + full MVP build

- Scaffolded with `create-next-app@latest`: Next.js 16.4.6, React 19.3,
  TypeScript (strict), Tailwind CSS v4.3.3, ESLint 9.
- Installed: `@supabase/ssr`, `@supabase/supabase-js`, `recharts`,
  `lucide-react`, `react-hook-form`, `@hookform/resolvers`, `zod`,
  `next-themes`, `sonner`, Radix primitives, `date-fns`;
  dev: `vitest`, `@vitest/coverage-v8`, `jsdom`.
  - Vitest 5 required `@types/node ^22 || >=24`; upgraded
    `@types/node` 20 → 24 (Node 24 is the runtime here).
- Design tokens per PRD §12 in `src/app/globals.css` (Tailwind v4
  CSS-first): dark default `#101114` / `#1A1C22` / `#F5F5F5`,
  accent `#8B7CFF`; light theme variables included.
- shadcn/ui (new-york style, Tailwind v4): 21 components added via
  the shadcn CLI into `src/components/ui/`.
- Supabase clients (`@supabase/ssr`): browser client, async server
  client (Next 16 async `cookies()`), proxy session refresh.
  Next 16 renamed `middleware` → `proxy`; implemented `src/proxy.ts`
  with route guards (protected routes → `/login?next=…`, authed
  users away from `/login`, `/signup`).
  - `cacheComponents` is enabled by the scaffold; the dashboard
    layout uses `export const instant = false` (the documented
    migration path) so server components can read the session.
- Database: `supabase/migrations/20261114000001_init.sql` — profiles,
  categories, transactions, budgets; RLS on every table; profile
  auto-creation trigger; category ownership/type validation triggers;
  unique budget constraint; indexes per PRD §7.5; 16 seeded system
  categories. Re-runnable seed in `supabase/seed.sql`.
- Shared library: `src/lib/finance.ts` (integer-paise money math,
  savings rate with zero-income guard, budget bands, INR formatting,
  period ranges), `src/lib/validations/index.ts` (Zod schemas),
  `src/types/database.ts` (typed models matching the migration).
- Features (all wired to Supabase via server actions / server
  components; no mock data):
  auth (signup/login/verify/forgot/reset/logout), dashboard
  (bento grid, charts, budget progress, quick-add), transactions
  (CRUD, search, filters, sort, server-side pagination),
  budgets (monthly, 80%/100% states), analytics (week/month/year/
  custom + previous-period comparison), categories (system +
  custom, guarded deletion), settings (profile, theme, date
  format, password, export, delete account), CSV import
  (preview, row validation, deterministic dedup) and export
  (respects filters).
- Unit tests: `tests/finance.test.ts` — savings rate incl. zero
  income, budget remaining/utilisation/status, net balance,
  paise-exact sums, INR/date formatting, period ranges.

### Verification (this run — 14 Nov 2026, final)

- `npm run typecheck` — **Passed** (0 errors)
- `npm run lint` — **Passed** (0 errors, 2 warnings — both
  `react-hooks/incompatible-library` on `form.watch()` in
  category-dialog and profile-form; benign, React Compiler just skips
  memoizing those two components)
- `npm run build` — **Passed** (Next.js 16.4.6, Turbopack; 17/17
  static pages generated; 6 static routes, 9 dynamic routes, proxy
  active). No Supabase credentials present at build time — the build
  passes without them by design (see the `cookies()`-first note in
  `src/lib/supabase/server.ts`).
- `npm run test` — **Passed** (53/53: 22 finance + 31 CSV)
- Production smoke test (`next start`, no credentials) — **Passed**:
  `/`, `/login`, `/signup`, `/forgot-password` all return 200 with
  correct content; `/dashboard` throws the clear "Supabase is not
  configured" error server-side and renders the global error boundary
  (expected without credentials).

Build fixes applied during integration (all in the coordinator's
scope):
- `src/types/database.ts`: added `Relationships` to all tables
  (supabase-js 2.119 `GenericTable` requires them) and converted row
  types from `interface` to `type` (interfaces lack the implicit
  index signature for `Record<string, unknown>`). Without both,
  every query result inferred as `never` (~40 type errors).
- Removed `export const dynamic = "force-dynamic"` from the two
  route handlers — incompatible with `cacheComponents`; both are
  dynamic anyway via `cookies()`.
- `src/lib/supabase/server.ts`: `cookies()` is now read before the
  env-var check, so build-time prerendering bails out to dynamic
  rendering instead of failing on the thrown error.
- Installed the `server-only` package and added the import to all
  six service files.
- Added `src/app/global-error.tsx` (layout-level errors, e.g. the
  unconfigured-Supabase case, are not caught by the segment
  error.tsx).
- Removed the `never`-workaround casts/comments left by the
  workstream agents once the shared type was fixed.

### Blocked (needs credentials — not attempted, not fabricated)

- Live Supabase connection: **Blocked** — no project URL/key supplied.
- Remote migration run (`supabase db push`): **Blocked**.
- Two-user RLS tests (PRD §8): **Blocked** — needs a live project +
  two test accounts.
- Auth flows / CRUD / persistence against real Supabase: **Not tested**
  (same blocker).
- Netlify deployment: **Not attempted** — no Netlify connector or
  credentials in this environment; see README for exact manual steps.
