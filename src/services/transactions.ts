import "server-only";

/**
 * Transactions service — server-only. Never import this module from
 * client code.
 */

import { createClient } from "@/lib/supabase/server";
import { fromPaise, toPaise } from "@/lib/finance";
import type { Transaction, TransactionType } from "@/types/database";

/** Category columns joined onto transaction rows. */
const CATEGORY_SELECT = "id, name, type, icon, color";

export interface TransactionFilters {
  search?: string;
  type?: TransactionType;
  categoryId?: string;
  paymentMethod?: string;
  /** Inclusive start, YYYY-MM-DD. */
  from?: string;
  /** Inclusive end, YYYY-MM-DD. */
  to?: string;
}

export interface ListTransactionsParams extends TransactionFilters {
  userId: string;
  sortBy?: "date" | "amount";
  sortDir?: "asc" | "desc";
  page: number;
  pageSize: number;
}

/** Escape PostgREST LIKE wildcards in a user search term. */
function escapeIlike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Structural type for a PostgREST filter builder: every filter method
 * returns the same builder (`this`), so one helper can filter both the
 * paginated list query and the totals query without losing their types.
 */
interface Filterable<Q> {
  or(filters: string): Q;
  eq(column: string, value: string): Q;
  gte(column: string, value: string): Q;
  lte(column: string, value: string): Q;
}

/** Apply the shared filters to a transactions query builder. */
function applyFilters<Q extends Filterable<Q>>(
  query: Q,
  filters: TransactionFilters,
): Q {
  let q = query;
  if (filters.search?.trim()) {
    const term = escapeIlike(filters.search.trim());
    q = q.or(`title.ilike.%${term}%,notes.ilike.%${term}%`);
  }
  if (filters.type) q = q.eq("type", filters.type);
  if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
  if (filters.paymentMethod) q = q.eq("payment_method", filters.paymentMethod);
  if (filters.from) q = q.gte("transaction_date", filters.from);
  if (filters.to) q = q.lte("transaction_date", filters.to);
  return q;
}

/**
 * Paginated transactions for a user, newest first by default.
 * Pagination and filtering happen server-side in Postgres.
 */
export async function listTransactions(
  params: ListTransactionsParams,
): Promise<{ data: Transaction[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(params.page) || 1);
  // 10,000 is the export cap; the UI uses 20.
  const pageSize = Math.min(10_000, Math.max(1, Math.floor(params.pageSize) || 20));
  const sortColumn = params.sortBy === "amount" ? "amount" : "transaction_date";
  const ascending = params.sortDir === "asc";

  const query = applyFilters(
    supabase
      .from("transactions")
      .select(`*, category:categories(${CATEGORY_SELECT})`, { count: "exact" })
      .eq("user_id", params.userId),
    params,
  );

  const { data, count, error } = await query
    .order(sortColumn, { ascending })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) throw new Error(`Failed to load transactions: ${error.message}`);
  return { data: data ?? [], total: count ?? 0 };
}

/** One transaction owned by the user, or null. */
export async function getTransaction(
  id: string,
  userId: string,
): Promise<Transaction | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(`*, category:categories(${CATEGORY_SELECT})`)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load transaction: ${error.message}`);
  return data ?? null;
}

/**
 * Distinct payment methods the user has used, for the filter dropdown.
 * PostgREST has no DISTINCT select, so this fetches the single column
 * and dedupes in memory (capped at 1,000 rows — payment methods are a
 * small set in practice).
 */
export async function getPaymentMethods(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("payment_method")
    .eq("user_id", userId)
    .not("payment_method", "is", null)
    .limit(1000);

  if (error) throw new Error(`Failed to load payment methods: ${error.message}`);
  const methods = new Set<string>();
  for (const row of data ?? []) {
    const method = row.payment_method?.trim();
    if (method) methods.add(method);
  }
  return [...methods].sort((a, b) => a.localeCompare(b));
}

export interface TransactionTotals {
  /** Rupees. */
  income: number;
  /** Rupees. */
  expense: number;
  /** income − expense, rupees. */
  net: number;
}

/**
 * Income/expense sums for the filtered set.
 *
 * NOTE (limitation): PostgREST has no server-side SUM through the JS
 * client without an RPC, so this selects only the `amount` and `type`
 * columns for the filtered set and sums in paise in memory. That keeps
 * full rows out of the response, but a very large filtered set still
 * scans one row per transaction. If that ever becomes slow, add a
 * `sum_transactions` Postgres function and call it via `.rpc()`.
 */
export async function getTransactionTotals(
  userId: string,
  filters: TransactionFilters = {},
): Promise<TransactionTotals> {
  const supabase = await createClient();
  const query = applyFilters(
    supabase.from("transactions").select("amount, type").eq("user_id", userId),
    filters,
  );
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load totals: ${error.message}`);

  let incomePaise = 0;
  let expensePaise = 0;
  for (const row of data ?? []) {
    if (row.type === "income") incomePaise += toPaise(row.amount);
    else expensePaise += toPaise(row.amount);
  }
  return {
    income: fromPaise(incomePaise),
    expense: fromPaise(expensePaise),
    net: fromPaise(incomePaise - expensePaise),
  };
}
