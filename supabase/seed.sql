-- Hisab — seed script (PRD §6.6, §9 step 6)
-- Re-runnable: inserts the 16 system categories, skipping any that
-- already exist. The same seed also runs inside migration
-- 20261114000001_init.sql; use this file when seeding a database whose
-- schema already exists (e.g. after `supabase db reset` with
-- seed.sql configured, or a manual SQL-editor run).
--
-- Run with:  psql "$DATABASE_URL" -f supabase/seed.sql
--   (or paste into the Supabase SQL editor)

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
