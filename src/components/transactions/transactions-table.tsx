"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, ReceiptText } from "lucide-react";

import { formatCurrency, formatDate, type DateFormat } from "@/lib/finance";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";

interface TransactionsTableProps {
  transactions: Transaction[];
  categories: Category[];
  dateFormat: DateFormat;
  hasActiveFilters: boolean;
}

export function TransactionsTable({
  transactions,
  categories,
  dateFormat,
  hasActiveFilters,
}: TransactionsTableProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  if (transactions.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ReceiptText className="size-6" />
          </span>
          <div>
            <p className="font-medium">
              {hasActiveFilters
                ? "No transactions match these filters"
                : "No transactions yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Try widening the search or clearing a filter."
                : "Add your first transaction to start tracking your money."}
            </p>
          </div>
          {!hasActiveFilters ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New transaction
            </Button>
          ) : null}
        </div>

        <TransactionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          categories={categories}
          onSaved={() => router.refresh()}
        />
      </>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const isIncome = tx.type === "income";
              return (
                <TableRow key={tx.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          isIncome
                            ? "bg-green-500/15 text-green-600 dark:text-green-400"
                            : "bg-red-500/15 text-red-500",
                        )}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="size-4" />
                        ) : (
                          <ArrowUpRight className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{tx.title}</p>
                        {tx.notes ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {tx.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {tx.category ? (
                      <Badge variant="outline" className="whitespace-nowrap">
                        {tx.category.color ? (
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: tx.category.color }}
                          />
                        ) : null}
                        {tx.category.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(tx.transaction_date, dateFormat)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {tx.payment_method ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium whitespace-nowrap tabular-nums",
                      isIncome
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-500",
                    )}
                  >
                    {isIncome ? "+" : "−"}
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(tx)}
                      aria-label={`Edit ${tx.title}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TransactionDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        categories={categories}
        transaction={editing ?? undefined}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
