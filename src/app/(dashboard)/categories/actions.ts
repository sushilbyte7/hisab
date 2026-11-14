"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z, type ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { categoryFormSchema } from "@/lib/validations";
import { getCategoryUsage } from "@/services/categories";
import type { Category, Database } from "@/types/database";

export type CategoryActionResult =
  | { ok: true }
  | { ok: false; error: string };

function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

/** Server client + the authed user (null when signed out). */
async function authedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

function revalidateCategoryPages() {
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

/**
 * Fetch a category and verify it is a custom category owned by the user.
 * Returns null for missing rows, system categories, and other users'
 * categories — the caller turns that into a friendly error. Never rely
 * on the UI hiding the edit/delete buttons.
 */
async function fetchOwnedCustomCategory(
  supabase: SupabaseClient<Database>,
  id: string,
  userId: string,
): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  if (data.is_default || data.user_id !== userId) return null;
  return data;
}

export async function createCategory(
  input: unknown,
): Promise<CategoryActionResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error) };
  }

  const { supabase, user } = await authedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to create a category." };
  }

  const { name, type, icon, color } = parsed.data;
  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name,
    type,
    icon: icon ?? null,
    color: color ?? null,
    is_default: false,
  });

  if (error) {
    // Unique index on (user_id, name, type) for custom categories.
    if (error.code === "23505") {
      return {
        ok: false,
        error: `A ${type} category named "${name}" already exists.`,
      };
    }
    return { ok: false, error: `Could not create category: ${error.message}` };
  }

  revalidateCategoryPages();
  return { ok: true };
}

export async function updateCategory(
  id: string,
  input: unknown,
): Promise<CategoryActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid category." };
  }
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error) };
  }

  const { supabase, user } = await authedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to edit a category." };
  }

  const existing = await fetchOwnedCustomCategory(supabase, id, user.id);
  if (!existing) {
    return {
      ok: false,
      error: "Category not found, or it is a system category that cannot be edited.",
    };
  }

  // Changing the type of a category with transactions would leave those
  // transactions inconsistent with the DB trigger that enforces
  // category type = transaction type, so it is blocked outright.
  if (parsed.data.type !== existing.type) {
    const usage = await getCategoryUsage(id, user.id);
    if (usage.transactions > 0) {
      return {
        ok: false,
        error:
          "Cannot change the type of a category that has transactions. Create a new category instead.",
      };
    }
  }

  const { name, type, icon, color } = parsed.data;
  const { error } = await supabase
    .from("categories")
    .update({ name, type, icon: icon ?? null, color: color ?? null })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: `A ${type} category named "${name}" already exists.`,
      };
    }
    return { ok: false, error: `Could not update category: ${error.message}` };
  }

  revalidateCategoryPages();
  return { ok: true };
}

export async function deleteCategory(
  id: string,
): Promise<CategoryActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid category." };
  }

  const { supabase, user } = await authedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to delete a category." };
  }

  const existing = await fetchOwnedCustomCategory(supabase, id, user.id);
  if (!existing) {
    return {
      ok: false,
      error:
        "Category not found, or it is a system category that cannot be deleted.",
    };
  }

  const usage = await getCategoryUsage(id, user.id);
  if (usage.transactions > 0 || usage.budgets > 0) {
    return {
      ok: false,
      error: `This category is used by ${usage.transactions} transaction(s) / ${usage.budgets} budget(s). Reassign or delete them first.`,
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    return { ok: false, error: `Could not delete category: ${error.message}` };
  }

  revalidateCategoryPages();
  return { ok: true };
}
