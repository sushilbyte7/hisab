/**
 * Hisab financial calculations (PRD §13).
 *
 * All authoritative money math runs on integer paise to avoid binary
 * floating-point error. Amounts arrive from Postgres NUMERIC(12,2) as
 * numbers or strings; `toPaise` normalises both.
 *
 * Date semantics: `transaction_date` is the financial date, never
 * `created_at`. Period ranges are inclusive on both ends and computed
 * in the user's local timezone.
 */

export type TransactionType = "income" | "expense";

export type MoneyInput = number | string;

/** Convert a rupee amount to integer paise. */
export function toPaise(amount: MoneyInput): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${amount}`);
  return Math.round(n * 100);
}

/** Convert integer paise back to rupees. */
export function fromPaise(paise: number): number {
  return paise / 100;
}

/** Sum rupee amounts exactly (via paise) and return rupees. */
export function sumAmounts(amounts: MoneyInput[]): number {
  return fromPaise(amounts.reduce<number>((acc, a) => acc + toPaise(a), 0));
}

/** Net balance for a period = income − expenses. */
export function netBalance(income: MoneyInput, expenses: MoneyInput): number {
  return fromPaise(toPaise(income) - toPaise(expenses));
}

/** Savings for a period = income − expenses (same as net balance). */
export function savingsAmount(
  income: MoneyInput,
  expenses: MoneyInput,
): number {
  return netBalance(income, expenses);
}

/**
 * Savings rate = (income − expenses) / income × 100.
 * Returns null when income is zero or negative (no division by zero).
 */
export function savingsRate(
  income: MoneyInput,
  expenses: MoneyInput,
): number | null {
  const incomePaise = toPaise(income);
  if (incomePaise <= 0) return null;
  const rate =
    ((incomePaise - toPaise(expenses)) / incomePaise) * 100;
  return Math.round(rate * 100) / 100;
}

/** Budget remaining = budget amount − eligible expense transactions. */
export function budgetRemaining(
  budgetAmount: MoneyInput,
  spent: MoneyInput,
): number {
  return fromPaise(toPaise(budgetAmount) - toPaise(spent));
}

/** Budget utilization = spent / budget × 100. Returns 0 for a zero budget. */
export function budgetUtilization(
  budgetAmount: MoneyInput,
  spent: MoneyInput,
): number {
  const budgetPaise = toPaise(budgetAmount);
  if (budgetPaise <= 0) return 0;
  const pct = (toPaise(spent) / budgetPaise) * 100;
  return Math.round(pct * 100) / 100;
}

/** Budget status bands (PRD §6.4): warn at 80%, exceeded at 100%+. */
export function budgetStatus(utilization: number): "ok" | "warning" | "exceeded" {
  if (utilization >= 100) return "exceeded";
  if (utilization >= 80) return "warning";
  return "ok";
}

/** Format a rupee amount as INR, e.g. ₹1,50,000.00 (en-IN grouping). */
export function formatCurrency(
  amount: MoneyInput,
  currency = "INR",
  opts: { decimals?: number } = {},
): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: opts.decimals ?? 2,
    maximumFractionDigits: opts.decimals ?? 2,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Compact INR for chart axes, e.g. ₹1.5L / ₹12.3K. */
export function formatCurrencyCompact(amount: MoneyInput): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(n) ? n : 0);
}

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

/** Format a YYYY-MM-DD date (or Date) per the user's date-format preference. */
export function formatDate(
  date: string | Date,
  format: DateFormat = "DD/MM/YYYY",
): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  switch (format) {
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    case "DD/MM/YYYY":
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}

/** Parse a YYYY-MM-DD string as a local-time Date (avoids UTC shift). */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Format a Date as YYYY-MM-DD in local time. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type PeriodKey = "week" | "month" | "year" | "custom";

export interface DateRange {
  /** Inclusive start, YYYY-MM-DD. */
  from: string;
  /** Inclusive end, YYYY-MM-DD. */
  to: string;
}

/**
 * Resolve a period selector to an inclusive [from, to] date range.
 * - week: last 7 days including today
 * - month: current calendar month
 * - year: current calendar year
 * - custom: caller-supplied range (validated, from <= to)
 */
export function getPeriodRange(
  period: PeriodKey,
  custom?: { from: string; to: string },
  now: Date = new Date(),
): DateRange {
  const today = toISODate(now);
  if (period === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { from: toISODate(start), to: today };
  }
  if (period === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toISODate(first), to: toISODate(last) };
  }
  if (period === "year") {
    return {
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
    };
  }
  if (!custom || !custom.from || !custom.to) {
    throw new Error("Custom period requires from and to dates");
  }
  if (custom.from > custom.to) {
    throw new Error("Custom period start must be on or before its end");
  }
  return { from: custom.from, to: custom.to };
}

/** The period immediately before `range`, same length, for comparisons. */
export function getPreviousPeriodRange(range: DateRange): DateRange {
  const from = parseLocalDate(range.from);
  const to = parseLocalDate(range.to);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { from: toISODate(prevFrom), to: toISODate(prevTo) };
}

/** Percentage change from `previous` to `current`; null when previous is 0. */
export function percentChange(
  current: MoneyInput,
  previous: MoneyInput,
): number | null {
  const prev = toPaise(previous);
  if (prev === 0) return null;
  const pct = ((toPaise(current) - prev) / Math.abs(prev)) * 100;
  return Math.round(pct * 100) / 100;
}

/** Month key "YYYY-MM" for a date, used by budget matching. */
export function monthKey(date: string | Date): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Human month label, e.g. "Nov 2026". */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}
