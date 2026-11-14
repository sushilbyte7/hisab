import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getDashboardData,
  parsePeriodSearchParams,
  type CategoryBreakdownItem,
} from "@/services/dashboard";
import { formatCurrency, formatDate } from "@/lib/finance";
import type { DateFormat } from "@/types/database";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { SavingsTrendChart } from "@/components/dashboard/savings-trend-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { QuickAddButton } from "@/components/dashboard/quick-add-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard | Hisab",
  description: "Your money at a glance — income, expenses, budgets and trends.",
};

interface DashboardPageProps {
  searchParams?: Promise<{
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}

function TopCategoriesCard({
  categories,
  totalExpenses,
  currency,
}: {
  categories: CategoryBreakdownItem[];
  totalExpenses: number;
  currency: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Highest Spending</CardTitle>
        <CardDescription>Top categories this period</CardDescription>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No expenses in this period yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {categories.map((category, index) => {
              const pct =
                totalExpenses > 0 ? (category.amount / totalExpenses) * 100 : 0;
              return (
                <li key={category.categoryId} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {category.name}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {pct.toFixed(0)}%
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatCurrency(category.amount, currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const { period, range, from, to } = parsePeriodSearchParams(params);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, categoriesRes, data] = await Promise.all([
    supabase
      .from("profiles")
      .select("currency, date_format")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, user_id, name, type, icon, color, is_default, created_at")
      .order("name"),
    getDashboardData(user.id, range),
  ]);

  const profile = profileRes.data;
  const currency = profile?.currency ?? "INR";
  const dateFormat: DateFormat = profile?.date_format ?? "DD/MM/YYYY";
  const categories = categoriesRes.data ?? [];

  const rangeLabel = `${formatDate(range.from, dateFormat)} – ${formatDate(range.to, dateFormat)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
        <QuickAddButton categories={categories} />
      </div>

      <PeriodSelector period={period} from={from} to={to} />

      {!data.hasTransactions ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Wallet className="size-7" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">No transactions yet</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add your first income or expense and your dashboard will fill
                up with charts, trends and budgets.
              </p>
            </div>
            <QuickAddButton categories={categories} label="Add your first transaction" />
          </CardContent>
        </Card>
      ) : (
        <>
          <SummaryCards
            current={data}
            previous={data.previous}
            currency={currency}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <IncomeExpenseChart
                data={data.monthlySeries.map((m) => ({
                  label: m.month,
                  income: m.income,
                  expenses: m.expenses,
                }))}
                currency={currency}
              />
            </div>
            <CategoryDonut data={data.categoryBreakdown} currency={currency} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrendChart data={data.trendSeries} currency={currency} />
            </div>
            <SavingsTrendChart data={data.savingsTrend} currency={currency} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RecentTransactions
              transactions={data.recentTransactions}
              currency={currency}
              dateFormat={dateFormat}
            />
            <BudgetProgress budgets={data.budgets} currency={currency} />
            <TopCategoriesCard
              categories={data.topCategories}
              totalExpenses={data.expenses}
              currency={currency}
            />
          </div>
        </>
      )}
    </div>
  );
}
