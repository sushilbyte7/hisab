import Link from "next/link";
import { ArrowRight, PiggyBank } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/finance";
import type { BudgetWithSpend } from "@/types/database";

interface BudgetProgressProps {
  /** Current-month budgets, highest utilization first. */
  budgets: BudgetWithSpend[];
  currency: string;
}

const STATUS_BAR: Record<BudgetWithSpend["status"], string> = {
  ok: "[&>[data-slot=progress-indicator]]:bg-emerald-500",
  warning: "[&>[data-slot=progress-indicator]]:bg-amber-500",
  exceeded: "[&>[data-slot=progress-indicator]]:bg-destructive",
};

const STATUS_TEXT: Record<BudgetWithSpend["status"], string> = {
  ok: "text-muted-foreground",
  warning: "text-amber-500",
  exceeded: "text-destructive",
};

/** This month's budgets (top 3 by utilization) with progress bars. */
export function BudgetProgress({ budgets, currency }: BudgetProgressProps) {
  const top = budgets.slice(0, 3);
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Monthly Budgets</CardTitle>
          <CardDescription>How this month&apos;s budgets are tracking</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="-mr-2">
          <Link href="/budgets">
            View all
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
            <PiggyBank className="size-8" aria-hidden />
            <p className="text-sm">No budgets set for this month.</p>
            <Button variant="link" size="sm" asChild>
              <Link href="/budgets">Create a budget</Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-5">
            {top.map((budget) => (
              <li key={budget.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          budget.category?.color ?? "var(--chart-1)",
                      }}
                      aria-hidden
                    />
                    <span className="truncate">
                      {budget.category?.name ?? "Uncategorized"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCurrency(budget.spent, currency)} of{" "}
                    {formatCurrency(budget.amount, currency)}
                  </span>
                </div>
                <Progress
                  value={Math.min(budget.utilization, 100)}
                  className={cn(STATUS_BAR[budget.status])}
                />
                <p
                  className={cn(
                    "text-xs tabular-nums",
                    STATUS_TEXT[budget.status],
                  )}
                >
                  {budget.status === "exceeded"
                    ? `Over budget by ${formatCurrency(Math.abs(budget.remaining), currency)}`
                    : `${formatCurrency(budget.remaining, currency)} left · ${budget.utilization.toFixed(0)}% used`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
