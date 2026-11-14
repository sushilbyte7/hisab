import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, monthLabel } from "@/lib/finance";
import type { BudgetWithSpend, Category } from "@/types/database";
import { listBudgetsWithSpend } from "@/services/budgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BudgetCardActions,
  NewBudgetButton,
} from "@/components/budgets/budget-dialog";

export const metadata: Metadata = {
  title: "Budgets — Hisab",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

const STATUS_META = {
  ok: {
    label: "On track",
    badgeClass: "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400",
    barClass: "",
  },
  warning: {
    label: "Near limit",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    barClass: "[&>[data-slot=progress-indicator]]:bg-amber-500",
  },
  exceeded: {
    label: "Exceeded",
    badgeClass: "border-red-500/40 bg-red-500/10 text-red-500",
    barClass: "[&>[data-slot=progress-indicator]]:bg-red-500",
  },
} as const;

function BudgetCard({
  budget,
  categories,
  month,
  year,
}: {
  budget: BudgetWithSpend;
  categories: Category[];
  month: number;
  year: number;
}) {
  const status = STATUS_META[budget.status];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {budget.category?.color ? (
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: budget.category.color }}
            />
          ) : null}
          <CardTitle className="truncate text-base">
            {budget.category?.name ?? "Unknown category"}
          </CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className={status.badgeClass}>
            {status.label}
          </Badge>
          <BudgetCardActions
            budget={budget}
            categories={categories}
            month={month}
            year={year}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-bold tabular-nums">
            {formatCurrency(budget.spent)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              of {formatCurrency(budget.amount)}
            </span>
          </p>
          <p className="text-sm font-medium tabular-nums">
            {budget.utilization}%
          </p>
        </div>
        <Progress
          value={Math.min(budget.utilization, 100)}
          className={status.barClass}
          aria-label={`${budget.category?.name ?? "Budget"} usage: ${budget.utilization}%`}
        />
        <p className="text-sm text-muted-foreground">
          {budget.remaining >= 0 ? (
            <>
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(budget.remaining)}
              </span>{" "}
              remaining
            </>
          ) : (
            <>
              <span className="font-medium text-red-500 tabular-nums">
                {formatCurrency(Math.abs(budget.remaining))}
              </span>{" "}
              over budget
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const now = new Date();
  const parsedMonth = Number.parseInt(asString(params.month), 10);
  const parsedYear = Number.parseInt(asString(params.year), 10);
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : now.getMonth() + 1;
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : now.getFullYear();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [categoriesRes, budgets] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("type", "expense")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order("name"),
    listBudgetsWithSpend(user.id, year, month),
  ]);

  if (categoriesRes.error) {
    throw new Error(
      `Failed to load categories: ${categoriesRes.error.message}`,
    );
  }
  const expenseCategories = categoriesRes.data ?? [];

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const yearOptions: number[] = [];
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
    yearOptions.push(y);
  }

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Monthly spending limits, per category.
          </p>
        </div>
        <NewBudgetButton
          categories={expenseCategories}
          month={month}
          year={year}
        />
      </div>

      {/* Month selector: prev/next links + a plain GET form (no JS needed). */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild aria-label="Previous month">
          <Link href={`/budgets?month=${prev.month}&year=${prev.year}`}>
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <form action="/budgets" method="get" className="flex items-center gap-2">
          <select
            name="month"
            defaultValue={month}
            aria-label="Month"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            name="year"
            defaultValue={year}
            aria-label="Year"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">
            Go
          </Button>
        </form>
        <Button variant="outline" size="icon" asChild aria-label="Next month">
          <Link href={`/budgets?month=${next.month}&year=${next.year}`}>
            <ChevronRight className="size-4" />
          </Link>
        </Button>
        <span className="ml-1 text-sm font-medium">
          {monthLabel(year, month)}
        </span>
      </div>

      {budgets.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <p>
              Total budgeted:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(totalBudget)}
              </span>
            </p>
            <p>
              Total spent:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(totalSpent)}
              </span>
            </p>
            <p>
              Remaining:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(totalBudget - totalSpent)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                categories={expenseCategories}
                month={month}
                year={year}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <PiggyBank className="size-6" />
          </span>
          <div>
            <p className="font-medium">
              No budgets for {monthLabel(year, month)}
            </p>
            <p className="text-sm text-muted-foreground">
              Set a spending limit for a category to track it here.
            </p>
          </div>
          <NewBudgetButton
            categories={expenseCategories}
            month={month}
            year={year}
          />
        </div>
      )}
    </div>
  );
}
