"use client";

import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
import type { SavingsPoint } from "@/services/dashboard";

interface SavingsTrendChartProps {
  data: SavingsPoint[];
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

/** Monthly savings (income − expenses) line chart for the last 6 months. */
export function SavingsTrendChart({
  data,
  title = "Savings Trend",
  description = "Monthly savings (income minus expenses)",
  currency = "INR",
}: SavingsTrendChartProps) {
  const hasData = data.some((d) => d.savings !== 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <LineChartIcon className="size-8" aria-hidden />
            <p className="text-sm">No savings data for the last 6 months yet.</p>
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
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
                <ReferenceLine y={0} stroke="var(--border)" />
                <Line
                  type="monotone"
                  dataKey="savings"
                  name="Savings"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--chart-1)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
