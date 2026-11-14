import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/finance";
import type { DateFormat, TransactionType } from "@/types/database";
import {
  getPaymentMethods,
  getTransactionTotals,
  listTransactions,
} from "@/services/transactions";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionsToolbar } from "@/components/transactions/transactions-toolbar";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Pagination } from "@/components/transactions/pagination";

export const metadata: Metadata = {
  title: "Transactions — Hisab",
};

const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function asType(value: string): TransactionType | undefined {
  return value === "income" || value === "expense" ? value : undefined;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const q = asString(params.q);
  const type = asType(asString(params.type));
  const category = asString(params.category);
  const payment = asString(params.payment);
  const from = asString(params.from);
  const to = asString(params.to);
  const sort = asString(params.sort) === "amount" ? "amount" : "date";
  const dir = asString(params.dir) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number.parseInt(asString(params.page), 10) || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const filters = {
    search: q || undefined,
    type,
    categoryId: category || undefined,
    paymentMethod: payment || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const [profileRes, categoriesRes, list, totals, paymentMethods] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("date_format")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("categories")
        .select("*")
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order("name"),
      listTransactions({ userId: user.id, ...filters, sortBy: sort, sortDir: dir, page, pageSize: PAGE_SIZE }),
      getTransactionTotals(user.id, filters),
      getPaymentMethods(user.id),
    ]);

  if (categoriesRes.error) {
    throw new Error(`Failed to load categories: ${categoriesRes.error.message}`);
  }

  const categories = categoriesRes.data ?? [];
  const dateFormat: DateFormat =
    profileRes.data?.date_format ?? "DD/MM/YYYY";

  const totalPages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  if (page > totalPages && list.total > 0) {
    const redirectParams = new URLSearchParams();
    if (q) redirectParams.set("q", q);
    if (type) redirectParams.set("type", type);
    if (category) redirectParams.set("category", category);
    if (payment) redirectParams.set("payment", payment);
    if (from) redirectParams.set("from", from);
    if (to) redirectParams.set("to", to);
    redirectParams.set("sort", sort);
    redirectParams.set("dir", dir);
    redirectParams.set("page", String(totalPages));
    redirect(`/transactions?${redirectParams.toString()}`);
  }

  const baseQuery = new URLSearchParams();
  if (q) baseQuery.set("q", q);
  if (type) baseQuery.set("type", type);
  if (category) baseQuery.set("category", category);
  if (payment) baseQuery.set("payment", payment);
  if (from) baseQuery.set("from", from);
  if (to) baseQuery.set("to", to);
  baseQuery.set("sort", sort);
  baseQuery.set("dir", dir);

  const hasActiveFilters = Boolean(
    q || type || category || payment || from || to,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Every rupee in and out{hasActiveFilters ? " (filtered)" : ""}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
              <ArrowDownLeft className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Income</p>
              <p className="font-semibold text-green-600 tabular-nums dark:text-green-400">
                {formatCurrency(totals.income)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-red-500/15 text-red-500">
              <ArrowUpRight className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Expenses</p>
              <p className="font-semibold text-red-500 tabular-nums">
                {formatCurrency(totals.expense)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Wallet className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Net</p>
              <p className="font-semibold tabular-nums">
                {formatCurrency(totals.net)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <TransactionsToolbar
        categories={categories}
        paymentMethods={paymentMethods}
        filters={{
          q,
          type: type ?? "",
          category,
          payment,
          from,
          to,
          sort,
          dir,
        }}
      />

      <TransactionsTable
        transactions={list.data}
        categories={categories}
        dateFormat={dateFormat}
        hasActiveFilters={hasActiveFilters}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={list.total}
        pageSize={PAGE_SIZE}
        baseQuery={baseQuery.toString()}
      />
    </div>
  );
}
