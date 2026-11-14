"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { budgetFormSchema } from "@/lib/validations";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const REVALIDATE_PATHS = ["/budgets", "/dashboard", "/analytics", "/transactions"];

const DUPLICATE_BUDGET_ERROR =
  "A budget already exists for this category and month";

function revalidateAll() {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
}

async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function firstIssue(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    const issue = (error as { issues: { message?: string }[] }).issues[0];
    if (issue?.message) return issue.message;
  }
  return "Invalid input";
}

/**
 * Verify a category is visible to the user (system or their own) and is
 * an expense category — budgets only exist for spending.
 */
async function checkExpenseCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string,
): Promise<string | null> {
  const { data: category, error } = await supabase
    .from("categories")
    .select("id, type")
    .eq("id", categoryId)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .maybeSingle();
  if (error) return "Could not verify the category";
  if (!category) return "Category not found";
  if (category.type !== "expense") {
    return "Budgets can only be set for expense categories";
  }
  return null;
}

export async function createBudget(input: unknown): Promise<ActionResult> {
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return { ok: false, error: "You must be signed in." };

    const parsed = budgetFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstIssue(parsed.error) };
    }
    const values = parsed.data;

    const categoryError = await checkExpenseCategory(
      supabase,
      user.id,
      values.category_id,
    );
    if (categoryError) return { ok: false, error: categoryError };

    const { data, error } = await supabase
      .from("budgets")
      .insert({
        user_id: user.id,
        category_id: values.category_id,
        amount: values.amount,
        month: values.month,
        year: values.year,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: DUPLICATE_BUDGET_ERROR };
      }
      return { ok: false, error: "Could not save the budget." };
    }
    revalidateAll();
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function updateBudget(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return { ok: false, error: "You must be signed in." };

    const parsed = budgetFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstIssue(parsed.error) };
    }
    const values = parsed.data;

    const categoryError = await checkExpenseCategory(
      supabase,
      user.id,
      values.category_id,
    );
    if (categoryError) return { ok: false, error: categoryError };

    const { data, error } = await supabase
      .from("budgets")
      .update({
        category_id: values.category_id,
        amount: values.amount,
        month: values.month,
        year: values.year,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: DUPLICATE_BUDGET_ERROR };
      }
      return { ok: false, error: "Could not update the budget." };
    }
    if (!data) return { ok: false, error: "Budget not found." };
    revalidateAll();
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return { ok: false, error: "You must be signed in." };

    const { data, error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: "Could not delete the budget." };
    if (!data) return { ok: false, error: "Budget not found." };
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
