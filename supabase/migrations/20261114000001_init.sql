-- Hisab — initial schema (PRD §7, §8)
-- Creates: profiles, categories, transactions, budgets
-- RLS enabled on every table; policies enforce per-user isolation.
-- Profile auto-creation trigger; category ownership/type validation
-- triggers; indexes per PRD §7.5; 16 seeded system categories.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Keep updated_at current on UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (PRD §7.1)
-- One row per auth user. `theme` and `date_format` are display preferences.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  currency text not null default 'INR',
  date_format text not null default 'DD/MM/YYYY',
  theme text not null default 'dark'
    check (theme in ('dark', 'light')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when a user signs up. Runs as the function owner
-- (SECURITY DEFINER) so RLS on profiles cannot block the insert; it only
-- ever inserts the row for the user being created, so it cannot escalate
-- privileges for any other account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories (PRD §7.2)
-- System categories: user_id IS NULL and is_default = true.
-- Custom categories: user_id = owner, is_default = false.
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text,
  color text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  -- A system category is default iff it has no owner.
  constraint categories_default_owner_consistent
    check ((is_default and user_id is null) or (not is_default and user_id is not null))
);

-- System category names are unique per type; a user's custom names are
-- unique per user+type.
create unique index categories_system_name_type_unique
  on public.categories (name, type) where user_id is null;
create unique index categories_user_name_type_unique
  on public.categories (user_id, name, type) where user_id is not null;

-- ---------------------------------------------------------------------------
-- transactions (PRD §7.3)
-- ---------------------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  payment_method text,
  transaction_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- budgets (PRD §7.4)
-- ---------------------------------------------------------------------------

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  month smallint not null check (month between 1 and 12),
  year smallint not null check (year between 2000 and 2100),
  created_at timestamptz not null default now(),
  constraint budgets_user_category_month_year_unique
    unique (user_id, category_id, month, year)
);

-- ---------------------------------------------------------------------------
-- Category validation (PRD §7.3, §7.4, §8)
-- A transaction/budget may only reference a category that is a system
-- category or owned by the same user, and the category type must match.
-- Enforced in the database (SECURITY DEFINER so the check sees the row
-- even when RLS would hide another user's category — which then fails
-- the ownership test instead of silently passing).
-- ---------------------------------------------------------------------------

create or replace function public.validate_transaction_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category record;
begin
  select c.user_id, c.type into v_category
  from public.categories c
  where c.id = new.category_id;

  if not found then
    raise exception 'category does not exist';
  end if;

  if v_category.user_id is not null and v_category.user_id <> new.user_id then
    raise exception 'category does not belong to this user';
  end if;

  if v_category.type <> new.type then
    raise exception 'category type (%) does not match transaction type (%)',
      v_category.type, new.type;
  end if;

  return new;
end;
$$;

create trigger transactions_validate_category
  before insert or update on public.transactions
  for each row execute function public.validate_transaction_category();

create or replace function public.validate_budget_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category record;
begin
  select c.user_id, c.type into v_category
  from public.categories c
  where c.id = new.category_id;

  if not found then
    raise exception 'category does not exist';
  end if;

  if v_category.user_id is not null and v_category.user_id <> new.user_id then
    raise exception 'category does not belong to this user';
  end if;

  if v_category.type <> 'expense' then
    raise exception 'budgets can only reference expense categories';
  end if;

  return new;
end;
$$;

create trigger budgets_validate_category
  before insert or update on public.budgets
  for each row execute function public.validate_budget_category();

-- ---------------------------------------------------------------------------
-- Indexes (PRD §7.5)
-- ---------------------------------------------------------------------------

create index transactions_user_date_idx
  on public.transactions (user_id, transaction_date);
create index transactions_user_category_date_idx
  on public.transactions (user_id, category_id, transaction_date);
create index transactions_user_type_date_idx
  on public.transactions (user_id, type, transaction_date);
create index budgets_user_year_month_idx
  on public.budgets (user_id, year, month);
create index categories_user_type_idx
  on public.categories (user_id, type);

-- ---------------------------------------------------------------------------
-- Row Level Security (PRD §8) — enabled on every table.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- profiles: a user may only touch their own row.
create policy "profiles: owner can read own profile"
  on public.profiles for select
  using (id = auth.uid());
create policy "profiles: owner can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());
create policy "profiles: owner can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
create policy "profiles: owner can delete own profile"
  on public.profiles for delete
  using (id = auth.uid());

-- categories: read system categories + own custom categories; mutate only
-- own custom categories (is_default = false enforced on both sides).
create policy "categories: read system and own"
  on public.categories for select
  using (user_id is null or user_id = auth.uid());
create policy "categories: insert own custom only"
  on public.categories for insert
  with check (user_id = auth.uid() and is_default = false);
create policy "categories: update own custom only"
  on public.categories for update
  using (user_id = auth.uid() and is_default = false)
  with check (user_id = auth.uid() and is_default = false);
create policy "categories: delete own custom only"
  on public.categories for delete
  using (user_id = auth.uid() and is_default = false);

-- transactions: owner only, all operations.
create policy "transactions: owner can read own"
  on public.transactions for select
  using (user_id = auth.uid());
create policy "transactions: owner can insert own"
  on public.transactions for insert
  with check (user_id = auth.uid());
create policy "transactions: owner can update own"
  on public.transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "transactions: owner can delete own"
  on public.transactions for delete
  using (user_id = auth.uid());

-- budgets: owner only, all operations.
create policy "budgets: owner can read own"
  on public.budgets for select
  using (user_id = auth.uid());
create policy "budgets: owner can insert own"
  on public.budgets for insert
  with check (user_id = auth.uid());
create policy "budgets: owner can update own"
  on public.budgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "budgets: owner can delete own"
  on public.budgets for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed: 16 system categories (PRD §6.6). Idempotent via the partial
-- unique index on (name, type) where user_id is null.
-- Icons are lucide-react icon names; colors are hex values used by the UI.
-- ---------------------------------------------------------------------------

insert into public.categories (name, type, icon, color, is_default) values
  ('Food & Dining',    'expense', 'UtensilsCrossed', '#f97316', true),
  ('Shopping',         'expense', 'ShoppingBag',     '#ec4899', true),
  ('Transportation',   'expense', 'Car',             '#3b82f6', true),
  ('Entertainment',    'expense', 'Clapperboard',    '#a855f7', true),
  ('Bills & Utilities','expense', 'Receipt',         '#eab308', true),
  ('Healthcare',       'expense', 'HeartPulse',      '#ef4444', true),
  ('Education',        'expense', 'GraduationCap',   '#14b8a6', true),
  ('Travel',           'expense', 'Plane',           '#06b6d4', true),
  ('Personal Care',    'expense', 'Sparkles',        '#f43f5e', true),
  ('Others',           'expense', 'MoreHorizontal',  '#94a3b8', true),
  ('Salary',           'income',  'Briefcase',       '#22c55e', true),
  ('Freelancing',      'income',  'Laptop',          '#10b981', true),
  ('Business',         'income',  'Store',           '#84cc16', true),
  ('Investments',      'income',  'TrendingUp',      '#0ea5e9', true),
  ('Gifts',            'income',  'Gift',            '#d946ef', true),
  ('Other Income',     'income',  'Wallet',          '#64748b', true)
on conflict (name, type) where user_id is null do nothing;
