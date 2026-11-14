import "server-only";

/**
 * Budgets service — server-only. Never import this module from
 * client code.
 */

import { createClient } from "@/lib/supabase/server";
import {
  budgetRemaining,
  budgetStatus,
  budgetUtilization,
  fromPaise,
  toPaise,
} from "@/lib/finance";
import type { Budget, BudgetWithSpend } from "@/types/database";

/** Category columns joined onto budget rows. */
const CATEGORY_SELECT = "id, name, type, icon, color";

/** Inclusive [first, last] day of a month, as YYYY-MM-DD. */
function monthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Budgets for a user in one month, each joined with its category and
 * with spend computed from that month's expense transactions.
 *
 * Spend is summed from `amount` + `category_id` columns only (not full
 * rows); same RPC caveat as getTransactionTotals applies at very large
 * volumes.
 */
export async function listBudgetsWithSpend(
  userId: string,
  year: number,
  month: number,
): Promise<BudgetWithSpend[]> {
  const supabase = await createClient();
  const { from, to } = monthRange(year, month);

  const [budgetsRes, spendRes] = await Promise.all([
    supabase
      .from("budgets")
      .select(`*, category:categories(${CATEGORY_SELECT})`)
      .eq("user_id", userId)
      .eq("year", year)
      .eq("month", month)
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("amount, category_id")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("transaction_date", from)
      .lte("transaction_date", to),
  ]);

  if (budgetsRes.error) {
    throw new Error(`Failed to load budgets: ${budgetsRes.error.message}`);
  }
  if (spendRes.error) {
    throw new Error(`Failed to load budget spend: ${spendRes.error.message}`);
  }

  const spentByCategory = new Map<string, number>();
  for (const row of spendRes.data ?? []) {
    spentByCategory.set(
      row.category_id,
      (spentByCategory.get(row.category_id) ?? 0) + toPaise(row.amount),
    );
  }

  return (budgetsRes.data ?? []).map((budget) => {
    const spent = fromPaise(spentByCategory.get(budget.category_id) ?? 0);
    const utilization = budgetUtilization(budget.amount, spent);
    return {
      ...budget,
      spent,
      remaining: budgetRemaining(budget.amount, spent),
      utilization,
      status: budgetStatus(utilization),
    };
  });
}

/** One budget owned by the user, or null. */
export async function getBudget(
  id: string,
  userId: string,
): Promise<Budget | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select(`*, category:categories(${CATEGORY_SELECT})`)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load budget: ${error.message}`);
  return data ?? null;
}
