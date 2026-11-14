import { ArrowDownRight, ArrowUpRight, Minus, PiggyBank, TrendingDown, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, percentChange } from "@/lib/finance";
import type { PeriodTotals } from "@/services/dashboard";

interface SummaryCardsProps {
  current: PeriodTotals;
  previous: PeriodTotals;
  currency: string;
}

function Delta({
  current,
  previous,
  invert = false,
  suffix = "%",
  points = false,
}: {
  current: number | null;
  previous: number | null;
  /** True when an increase is bad (e.g. expenses). */
  invert?: boolean;
  suffix?: string;
  /** True to show a plain difference (percentage points) instead of % change. */
  points?: boolean;
}) {
  if (current === null || previous === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3.5" aria-hidden />
        No previous data
      </span>
    );
  }
  const change = points
    ? Math.round((current - previous) * 100) / 100
    : percentChange(current, previous);
  if (change === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3.5" aria-hidden />
        No previous data
      </span>
    );
  }
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3.5" aria-hidden />
        No change vs previous period
      </span>
    );
  }
  const up = change > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        good ? "text-emerald-500" : "text-destructive",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(change).toFixed(1)}
      {suffix} vs previous period
    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  delta,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  delta: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="mt-1">{delta}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Total Income / Total Expenses / Net Balance / Savings Rate, each with
 * a delta against the previous equal-length period. Expenses going up
 * is shown in red; income, net and savings rate going up in green.
 */
export function SummaryCards({ current, previous, currency }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        title="Total Income"
        value={formatCurrency(current.income, currency)}
        icon={TrendingUp}
        delta={<Delta current={current.income} previous={previous.income} />}
      />
      <SummaryCard
        title="Total Expenses"
        value={formatCurrency(current.expenses, currency)}
        icon={TrendingDown}
        delta={
          <Delta
            current={current.expenses}
            previous={previous.expenses}
            invert
          />
        }
      />
      <SummaryCard
        title="Net Balance"
        value={formatCurrency(current.net, currency)}
        icon={Wallet}
        delta={<Delta current={current.net} previous={previous.net} />}
      />
      <SummaryCard
        title="Savings Rate"
        value={
          current.savingsRate === null
            ? "—"
            : `${current.savingsRate.toFixed(1)}%`
        }
        icon={PiggyBank}
        delta={
          <Delta
            current={current.savingsRate}
            previous={previous.savingsRate}
            suffix=" pts"
            points
          />
        }
      />
    </div>
  );
}
