import "server-only";

// Server-only service: category reads for the (dashboard) routes.

import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";

/**
 * All categories visible to the user: the seeded system categories
 * (user_id IS NULL) plus their own custom categories. RLS enforces the
 * scoping; the explicit filter below restates it so the query never
 * depends on RLS alone, and `userId` is always taken from the session
 * by the caller — never from client input.
 * Ordered by type (expense, then income) and then by name.
 */
export async function listCategories(userId: string): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }
  return data ?? [];
}

/**
 * How many of the user's rows reference a category. Used by the delete
 * guard in the categories actions: a category in use cannot be deleted.
 */
export async function getCategoryUsage(
  categoryId: string,
  userId: string,
): Promise<{ transactions: number; budgets: number }> {
  const supabase = await createClient();
  const [transactions, budgets] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId)
      .eq("user_id", userId),
    supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId)
      .eq("user_id", userId),
  ]);

  if (transactions.error) {
    throw new Error(
      `Failed to count transactions for category: ${transactions.error.message}`,
    );
  }
  if (budgets.error) {
    throw new Error(
      `Failed to count budgets for category: ${budgets.error.message}`,
    );
  }
  return {
    transactions: transactions.count ?? 0,
    budgets: budgets.count ?? 0,
  };
}
