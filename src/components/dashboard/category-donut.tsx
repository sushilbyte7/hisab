"use client";

import { PieChart as PieChartIcon } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/finance";
import type { CategoryBreakdownItem } from "@/services/dashboard";

interface CategoryDonutProps {
  data: CategoryBreakdownItem[];
  title?: string;
  description?: string;
  currency?: string;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
};

/** Expense-by-category donut with a ranked list underneath. */
export function CategoryDonut({
  data,
  title = "Expenses by Category",
  description = "Where the money went in this period",
  currency = "INR",
}: CategoryDonutProps) {
  const total = data.reduce((acc, d) => acc + d.amount, 0);
  const hasData = total > 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <PieChartIcon className="size-8" aria-hidden />
            <p className="text-sm">No expenses in this period yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) =>
                      formatCurrency(Number(value ?? 0), currency)
                    }
                  />
                  <Pie
                    data={data}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.categoryId} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
              {data.map((entry) => {
                const pct = total > 0 ? (entry.amount / total) * 100 : 0;
                return (
                  <li
                    key={entry.categoryId}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    <span className="text-muted-foreground">
                      {pct.toFixed(0)}%
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(entry.amount, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
