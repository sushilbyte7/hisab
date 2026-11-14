import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildCategoryBreakdown,
  type CategoryBreakdownItem,
  type PeriodTotals,
} from "@/services/dashboard";
import {
  fromPaise,
  getPreviousPeriodRange,
  monthLabel,
  netBalance,
  parseLocalDate,
  savingsRate,
  sumAmounts,
  toISODate,
  toPaise,
  type DateRange,
} from "@/lib/finance";

/**
 * Analytics data service (server-only).
 *
 * Compares the selected range against the previous equal-length period
 * and buckets income vs expense by day / week / month depending on the
 * range length. All money math runs on integer paise.
 */

const MAX_RANGE_ROWS = 10_000;

export interface IncomeExpensePoint {
  label: string;
  income: number;
  expenses: number;
}

export interface AnalyticsData extends PeriodTotals {
  previous: PeriodTotals;
  incomeVsExpense: IncomeExpensePoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  /** Average expense per day across the selected range. */
  dailyAverage: number;
  /** Average expense per (30.44-day) month across the selected range. */
  monthlyAverage: number;
  topCategory: CategoryBreakdownItem | null;
  transactionCount: number;
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

function rangeDays(range: DateRange): number {
  const from = parseLocalDate(range.from);
  const to = parseLocalDate(range.to);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function shortDayLabel(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Bucket the range for the income-vs-expense chart:
 * - <= 31 days: one bucket per day
 * - <= 120 days: one bucket per week (starting at range.from)
 * - longer: one bucket per calendar month
 */
function buildIncomeVsExpense(
  rows: RangeTxnRow[],
  range: DateRange,
): IncomeExpensePoint[] {
  const days = rangeDays(range);
  const from = parseLocalDate(range.from);
  const to = parseLocalDate(range.to);

  const buckets: IncomeExpensePoint[] = [];
  const bucketIndex = new Map<string, number>();

  if (days <= 120) {
    const weekly = days > 31;
    const cursor = new Date(from);
    while (cursor <= to) {
      const iso = toISODate(cursor);
      bucketIndex.set(iso, buckets.length);
      buckets.push({ label: shortDayLabel(iso), income: 0, expenses: 0 });
      cursor.setDate(cursor.getDate() + (weekly ? 7 : 1));
    }
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
  } else {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      bucketIndex.set(key, buckets.length);
      buckets.push({
        label: monthLabel(cursor.getFullYear(), cursor.getMonth() + 1),
        income: 0,
        expenses: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const row of rows) {
      const idx = bucketIndex.get(row.transaction_date.slice(0, 7));
      if (idx === undefined) continue;
      const bucket = buckets[idx]!;
      if (row.type === "income") bucket.income += toPaise(row.amount);
      else bucket.expenses += toPaise(row.amount);
    }
  }

  // Buckets accumulated in paise; convert back to rupees.
  for (const b of buckets) {
    b.income = fromPaise(b.income);
    b.expenses = fromPaise(b.expenses);
  }
  return buckets;
}

export async function getAnalyticsData(
  userId: string,
  range: DateRange,
): Promise<AnalyticsData> {
  const supabase = await createClient();
  const previousRange = getPreviousPeriodRange(range);

  const [rangeRes, previousRes, categoriesRes] = await Promise.all([
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
      .gte("transaction_date", previousRange.from)
      .lte("transaction_date", previousRange.to)
      .limit(MAX_RANGE_ROWS),
    supabase
      .from("categories")
      .select("id, user_id, name, type, icon, color, is_default, created_at"),
  ]);

  for (const [name, res] of [
    ["range transactions", rangeRes],
    ["previous-period transactions", previousRes],
    ["categories", categoriesRes],
  ] as const) {
    if (res.error) {
      throw new Error(`Failed to load ${name}: ${res.error.message}`);
    }
  }

  const rangeRows = rangeRes.data ?? [];
  const previousRows = previousRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const current = totals(rangeRows);
  const previous = totals(previousRows);
  const categoryBreakdown = buildCategoryBreakdown(rangeRows, categoriesById);

  const days = Math.max(rangeDays(range), 1);
  const dailyAverage = Math.round((current.expenses / days) * 100) / 100;
  const monthlyAverage = Math.round(dailyAverage * 30.44 * 100) / 100;

  return {
    ...current,
    previous,
    incomeVsExpense: buildIncomeVsExpense(rangeRows, range),
    categoryBreakdown,
    dailyAverage,
    monthlyAverage,
    topCategory: categoryBreakdown[0] ?? null,
    transactionCount: rangeRows.length,
  };
}
