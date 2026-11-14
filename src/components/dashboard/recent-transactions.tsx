import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, type DateFormat } from "@/lib/finance";
import type { Transaction } from "@/types/database";

interface RecentTransactionsProps {
  transactions: Transaction[];
  currency: string;
  dateFormat: DateFormat;
}

/** Latest 5 transactions, with a link to the full list. */
export function RecentTransactions({
  transactions,
  currency,
  dateFormat,
}: RecentTransactionsProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest activity</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="-mr-2">
          <Link href="/transactions">
            View all
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
            <Receipt className="size-8" aria-hidden />
            <p className="text-sm">No transactions yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {transactions.map((txn) => {
              const isIncome = txn.type === "income";
              return (
                <li key={txn.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        txn.category?.color ?? "var(--chart-1)",
                    }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{txn.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {txn.category?.name ?? "Uncategorized"} ·{" "}
                      {formatDate(txn.transaction_date, dateFormat)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      isIncome ? "text-emerald-500" : "text-destructive",
                    )}
                  >
                    {isIncome ? "+" : "−"}
                    {formatCurrency(txn.amount, currency)}
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
