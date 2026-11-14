"use client";

import { CategoryDonut } from "@/components/dashboard/category-donut";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { TrendChart } from "@/components/dashboard/trend-chart";
import type { CategoryBreakdownItem } from "@/services/dashboard";
import type { IncomeExpensePoint } from "@/services/analytics";

/**
 * Analytics charts — thin wrappers that reuse the dashboard chart
 * components with analytics-specific titles. No duplicated chart code.
 */

export function AnalyticsIncomeExpenseChart({
  data,
  currency,
}: {
  data: IncomeExpensePoint[];
  currency: string;
}) {
  return (
    <IncomeExpenseChart
      data={data}
      title="Income vs Expenses"
      description="Bucketed by day, week or month depending on the selected range"
      currency={currency}
    />
  );
}

export function AnalyticsCategoryChart({
  data,
  currency,
}: {
  data: CategoryBreakdownItem[];
  currency: string;
}) {
  return (
    <CategoryDonut
      data={data}
      title="Category Breakdown"
      description="Expense share by category for the selected period"
      currency={currency}
    />
  );
}

export function AnalyticsTrendChart({
  data,
  currency,
}: {
  data: IncomeExpensePoint[];
  currency: string;
}) {
  return (
    <TrendChart
      data={data}
      title="Spending Trend"
      description="Income and expenses across the selected period"
      currency={currency}
    />
  );
}
