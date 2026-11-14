import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  BudgetWithSpend,
  Category,
  Transaction,
} from "@/types/database";
import {
  budgetRemaining,
  budgetStatus,
  budgetUtilization,
  fromPaise,
  getPeriodRange,
  getPreviousPeriodRange,
  monthLabel,
  netBalance,
  parseLocalDate,
  savingsRate,
  sumAmounts,
  toISODate,
  toPaise,
  type DateRange,
  type PeriodKey,
} from "@/lib/finance";

/**
 * Dashboard data service (server-only).
 *
 * All queries are scoped to `userId` and to a date range; aggregation
 * runs in JS on integer paise via the finance helpers. No unbounded
 * fetches: range queries are date-bounded and hard-capped.
 */

/** Safety cap on range-bounded transaction fetches. */
const MAX_RANGE_ROWS = 10_000;

/** Fallback donut colors for categories without a stored color. */
const FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export interface PeriodTotals {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number | null;
}

export interface MonthlyPoint {
  /** "YYYY-MM" key, for stable React keys. */
  key: string;
  /** Human label, e.g. "Nov 2026". */
  month: string;
  income: number;
  expenses: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
}

export interface TrendPoint {
  /** Bucket start, YYYY-MM-DD. */
  date: string;
  /** Axis label, e.g. "12 Nov". */
  label: string;
  income: number;
  expenses: number;
}

export interface SavingsPoint {
  key: string;
  month: string;
  savings: number;
}

export interface DashboardData extends PeriodTotals {
  previous: PeriodTotals;
  monthlySeries: MonthlyPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  trendSeries: TrendPoint[];
  savingsTrend: SavingsPoint[];
  recentTransactions: Transaction[];
  /** Current-month budgets, sorted by utilization (highest first). */
  budgets: BudgetWithSpend[];
  topCategories: CategoryBreakdownItem[];
  /** False only when the user has no transactions at all. */
  hasTransactions: boolean;
}

type RangeTxnRow = {
  amount: number | string;
  type: "income" | "expense";
  transaction_date: string;
  category_id: string;
};

function totals(rows: RangeTxnRow[]): PeriodTotals {
  const income = sumAmounts(
    rows.filter((r) => r.type === "income").map((r) => r.amount),
  );
  const expenses = sumAmounts(
    rows.filter((r) => r.type === "expense").map((r) => r.amount),
  );
  return {
    income,
    expenses,
    net: netBalance(income, expenses),
    savingsRate: savingsRate(income, expenses),
  };
}

/** Group expense rows by category into a sorted breakdown. */
export function buildCategoryBreakdown(
  rows: RangeTxnRow[],
  categoriesById: Map<string, Category>,
): CategoryBreakdownItem[] {
  const byCategory = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== "expense") continue;
    byCategory.set(
      row.category_id,
      (byCategory.get(row.category_id) ?? 0) + toPaise(row.amount),
    );
  }
  const items: CategoryBreakdownItem[] = [];
  let fallbackIndex = 0;
  for (const [categoryId, paise] of byCategory) {
    const category = categoriesById.get(categoryId);
    items.push({
      categoryId,
      name: category?.name ?? "Uncategorized",
      color:
        category?.color ??
        FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length]!,
      amount: fromPaise(paise),
    });
    if (!category?.color) fallbackIndex += 1;
  }
  items.sort((a, b) => b.amount - a.amount);
  return items;
}

function shortDayLabel(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Daily buckets when the range is <= 60 days, otherwise weekly buckets
 * starting at `range.from` (last bucket may be partial).
 */
function buildTrendSeries(rows: RangeTxnRow[], range: DateRange): TrendPoint[] {
  const from = parseLocalDate(range.from);
  const to = parseLocalDate(range.to);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const weekly = days > 60;

  const buckets: TrendPoint[] = [];
  if (weekly) {
    const cursor = new Date(from);
    while (cursor <= to) {
      const start = toISODate(cursor);
      buckets.push({ date: start, label: shortDayLabel(start), income: 0, expenses: 0 });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    const cursor = new Date(from);
    while (cursor <= to) {
      const iso = toISODate(cursor);
      buckets.push({ date: iso, label: shortDayLabel(iso), income: 0, expenses: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const bucketIndex = new Map(buckets.map((b, i) => [b.date, i]));
  for (const row of rows) {
    let key = row.transaction_date;
    if (weekly) {
      const d = parseLocalDate(row.transaction_date);
      const offset = Math.floor(
        (d.getTime() - from.getTime()) / (7 * 86_400_000),
      );
      const weekStart = new Date(from);
      weekStart.setDate(weekStart.getDate() + offset * 7);
      key = toISODate(weekStart);
    }
    const idx = bucketIndex.get(key);
    if (idx === undefined) continue;
    const bucket = buckets[idx]!;
    if (row.type === "income") bucket.income += toPaise(row.amount);
    else bucket.expenses += toPaise(row.amount);
  }
  // Buckets accumulated in paise; convert back to rupees.
  for (const b of buckets) {
    b.income = fromPaise(b.income);
    b.expenses = fromPaise(b.expenses);
  }
  return buckets;
}

/** Last 6 calendar months (oldest first), anchored at today. */
function lastSixMonths(now: Date): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: monthLabel(d.getFullYear(), d.getMonth() + 1),
    });
  }
  return months;
}

export async function getDashboardData(
  userId: string,
  range: DateRange,
): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const months = lastSixMonths(now);
  const sixMonthStart = `${months[0]!.key}-01`;
  const previousRange = getPreviousPeriodRange(range);

  const [
    rangeRes,
    sixMonthRes,
    recentRes,
    budgetsRes,
    previousRes,
    categoriesRes,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, type, transaction_date, category_id")
      .eq("user_id", userId)
      .gte("transaction_date", range.from)
      .lte("transaction_date", range.to)
      .limit(MAX_RANGE_ROWS),
    supabase
      .from("transactions")
      .select("amount, type, transaction_date, category_id")
      .eq("user_id", userId)
      .gte("transaction_date", sixMonthStart)
      .lte("transaction_date", toISODate(now))
      .limit(MAX_RANGE_ROWS),
    supabase
      .from("transactions")
      .select(
        "id, user_id, category_id, title, amount, type, payment_method, transaction_date, notes, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("budgets")
      .select("id, user_id, category_id, amount, month, year, created_at")
      .eq("user_id", userId)
      .eq("month", currentMonth)
      .eq("year", currentYear),
    supabase
      .from("transactions")
      .select("amount, type, transaction_date, category_id")
      .eq("user_id", userId)
      .gte("transaction_date", previousRange.from)
      .lte("transaction_date", previousRange.to)
      .limit(MAX_RANGE_ROWS),
    supabase
      .from("categories")
      .select("id, user_id, name, type, icon, color, is_default, created_at"),
  ]);

  for (const [name, res] of [
    ["range transactions", rangeRes],
    ["six-month transactions", sixMonthRes],
    ["recent transactions", recentRes],
    ["budgets", budgetsRes],
    ["previous-period transactions", previousRes],
    ["categories", categoriesRes],
  ] as const) {
    if (res.error) {
      throw new Error(`Failed to load ${name}: ${res.error.message}`);
    }
  }

  const rangeRows = rangeRes.data ?? [];
  const sixMonthRows = sixMonthRes.data ?? [];
  const recentRows = recentRes.data ?? [];
  const budgetRows = budgetsRes.data ?? [];
  const previousRows = previousRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const current = totals(rangeRows);
  const previous = totals(previousRows);

  // Monthly series + savings trend from the six-month window.
  const monthlySeries: MonthlyPoint[] = months.map((m) => ({
    key: m.key,
    month: m.label,
    income: 0,
    expenses: 0,
  }));
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const row of sixMonthRows) {
    const idx = monthIndex.get(row.transaction_date.slice(0, 7));
    if (idx === undefined) continue;
    const bucket = monthlySeries[idx]!;
    if (row.type === "income") bucket.income += toPaise(row.amount);
    else bucket.expenses += toPaise(row.amount);
  }
  // Buckets accumulated in paise; convert back to rupees.
  for (const b of monthlySeries) {
    b.income = fromPaise(b.income);
    b.expenses = fromPaise(b.expenses);
  }
  const savingsTrend: SavingsPoint[] = monthlySeries.map((m) => ({
    key: m.key,
    month: m.month,
    savings: netBalance(m.income, m.expenses),
  }));

  const categoryBreakdown = buildCategoryBreakdown(rangeRows, categoriesById);

  // Current-month spend per category (for budgets), from the six-month rows.
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const spentByCategory = new Map<string, number>();
  for (const row of sixMonthRows) {
    if (row.type !== "expense") continue;
    if (!row.transaction_date.startsWith(currentMonthKey)) continue;
    spentByCategory.set(
      row.category_id,
      (spentByCategory.get(row.category_id) ?? 0) + toPaise(row.amount),
    );
  }

  const budgets: BudgetWithSpend[] = budgetRows.map((b) => {
    const spent = fromPaise(spentByCategory.get(b.category_id) ?? 0);
    const utilization = budgetUtilization(b.amount, spent);
    const category = categoriesById.get(b.category_id);
    return {
      ...b,
      category: category
        ? {
            id: category.id,
            name: category.name,
            type: category.type,
            icon: category.icon,
            color: category.color,
          }
        : null,
      spent,
      remaining: budgetRemaining(b.amount, spent),
      utilization,
      status: budgetStatus(utilization),
    };
  });
  budgets.sort((a, b) => b.utilization - a.utilization);

  const recentTransactions: Transaction[] = recentRows.map((t) => {
    const category = categoriesById.get(t.category_id);
    return {
      ...t,
      category: category
        ? {
            id: category.id,
            name: category.name,
            type: category.type,
            icon: category.icon,
            color: category.color,
          }
        : null,
    };
  });

  return {
    ...current,
    previous,
    monthlySeries,
    categoryBreakdown,
    trendSeries: buildTrendSeries(rangeRows, range),
    savingsTrend,
    recentTransactions,
    budgets,
    topCategories: categoryBreakdown.slice(0, 3),
    hasTransactions: recentTransactions.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Period resolution shared by the dashboard and analytics pages.
// ---------------------------------------------------------------------------

export interface ResolvedPeriod {
  period: PeriodKey;
  range: DateRange;
  /** Echoed back for the custom date inputs (custom only). */
  from?: string;
  to?: string;
}

const PERIOD_KEYS: PeriodKey[] = ["week", "month", "year", "custom"];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resolve `?period=…&from=…&to=…` search params to a period + range.
 * Invalid or missing values fall back to the current month — never throws.
 */
export function parsePeriodSearchParams(params: {
  period?: string | string[];
  from?: string | string[];
  to?: string | string[];
}): ResolvedPeriod {
  const rawPeriod = firstParam(params.period);
  const period: PeriodKey = PERIOD_KEYS.includes(rawPeriod as PeriodKey)
    ? (rawPeriod as PeriodKey)
    : "month";
  try {
    if (period === "custom") {
      const from = firstParam(params.from);
      const to = firstParam(params.to);
      if (
        from &&
        to &&
        ISO_DATE_RE.test(from) &&
        ISO_DATE_RE.test(to) &&
        from <= to
      ) {
        return { period, range: getPeriodRange("custom", { from, to }), from, to };
      }
      // Invalid custom input: fall back to the current month.
      return { period: "month", range: getPeriodRange("month") };
    }
    return { period, range: getPeriodRange(period) };
  } catch {
    return { period: "month", range: getPeriodRange("month") };
  }
}
