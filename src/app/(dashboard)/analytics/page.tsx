import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, CalendarDays, Hash, Tag, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAnalyticsData } from "@/services/analytics";
import { parsePeriodSearchParams } from "@/services/dashboard";
import { formatCurrency, formatDate } from "@/lib/finance";
import type { DateFormat } from "@/types/database";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import {
  AnalyticsCategoryChart,
  AnalyticsIncomeExpenseChart,
  AnalyticsTrendChart,
} from "@/components/analytics/analytics-charts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Analytics | Hisab",
  description: "Compare periods, spot trends and see where your money goes.",
};

interface AnalyticsPageProps {
  searchParams?: Promise<{
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="truncate text-2xl font-bold tracking-tight">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {};
  const { period, range, from, to } = parsePeriodSearchParams(params);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, data] = await Promise.all([
    supabase
      .from("profiles")
      .select("currency, date_format")
      .eq("id", user.id)
      .maybeSingle(),
    getAnalyticsData(user.id, range),
  ]);

  const profile = profileRes.data;
  const currency = profile?.currency ?? "INR";
  const dateFormat: DateFormat = profile?.date_format ?? "DD/MM/YYYY";
  const rangeLabel = `${formatDate(range.from, dateFormat)} – ${formatDate(range.to, dateFormat)}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
      </div>

      <PeriodSelector period={period} from={from} to={to} />

      {data.transactionCount === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart3 className="size-7" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">No data in this period</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                There are no transactions between {rangeLabel}. Try a
                different period, or add a transaction from the dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <SummaryCards
            current={data}
            previous={data.previous}
            currency={currency}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Avg Daily Spend"
              value={formatCurrency(data.dailyAverage, currency)}
              description="Expenses per day in this period"
              icon={CalendarDays}
            />
            <StatCard
              title="Avg Monthly Spend"
              value={formatCurrency(data.monthlyAverage, currency)}
              description="Expenses per month, estimated"
              icon={Wallet}
            />
            <StatCard
              title="Highest Category"
              value={data.topCategory?.name ?? "—"}
              description={
                data.topCategory
                  ? formatCurrency(data.topCategory.amount, currency)
                  : "No expenses in this period"
              }
              icon={Tag}
            />
            <StatCard
              title="Transactions"
              value={String(data.transactionCount)}
              description="Income and expense entries in this period"
              icon={Hash}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AnalyticsIncomeExpenseChart
                data={data.incomeVsExpense}
                currency={currency}
              />
            </div>
            <AnalyticsCategoryChart
              data={data.categoryBreakdown}
              currency={currency}
            />
          </div>

          <AnalyticsTrendChart data={data.incomeVsExpense} currency={currency} />
        </>
      )}
    </div>
  );
}
