"use client";

import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatCurrencyCompact } from "@/lib/finance";

export interface IncomeExpensePoint {
  label: string;
  income: number;
  expenses: number;
}

interface IncomeExpenseChartProps {
  data: IncomeExpensePoint[];
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

/** Monthly (or bucketed) income vs expenses bar chart. */
export function IncomeExpenseChart({
  data,
  title = "Income vs Expenses",
  description = "Monthly income and expenses for the last 6 months",
  currency = "INR",
}: IncomeExpenseChartProps) {
  const hasData = data.some((d) => d.income !== 0 || d.expenses !== 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <BarChart3 className="size-8" aria-hidden />
            <p className="text-sm">No income or expenses in this period yet.</p>
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatCurrencyCompact(value)}
                  width={64}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) =>
                    formatCurrency(Number(value ?? 0), currency)
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
