"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionFormSchema } from "@/lib/validations";
import { dedupeKey, dedupeKeyForTransaction } from "@/lib/csv";
import { toPaise } from "@/lib/finance";
import type { TransactionType } from "@/types/database";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export interface ImportRowInput {
  /** Original CSV line number (header is line 1), for error reporting. */
  rowNumber: number;
  title: string;
  amount: number;
  type: TransactionType;
  category_id: string;
  payment_method?: string | null;
  transaction_date: string;
  notes?: string | null;
}

export type ImportResult =
  | {
      ok: true;
      inserted: number;
      skippedDuplicates: number;
      failed: { row: number; reason: string }[];
    }
  | { ok: false; error: string };

/** Max rows accepted in a single import batch. */
const MAX_IMPORT_ROWS = 1000;
/** Rows per insert chunk (PostgREST handles large inserts, but chunking keeps errors local). */
const INSERT_CHUNK_SIZE = 500;

const REVALIDATE_PATHS = ["/transactions", "/dashboard", "/analytics", "/budgets"];

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
 * Verify a category is visible to the user (system or their own) and its
 * type matches the transaction type. Returns an error message or null.
 */
async function checkCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string,
  type: TransactionType,
): Promise<string | null> {
  const { data: category, error } = await supabase
    .from("categories")
    .select("id, type")
    .eq("id", categoryId)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .maybeSingle();
  if (error) return "Could not verify the category";
  if (!category) return "Category not found";
  if (category.type !== type) {
    return `That category is for ${category.type} transactions, not ${type}`;
  }
  return null;
}

export async function createTransaction(input: unknown): Promise<ActionResult> {
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return { ok: false, error: "You must be signed in." };

    const parsed = transactionFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstIssue(parsed.error) };
    }
    const values = parsed.data;

    const categoryError = await checkCategory(
      supabase,
      user.id,
      values.category_id,
      values.type,
    );
    if (categoryError) return { ok: false, error: categoryError };

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        title: values.title,
        amount: values.amount,
        type: values.type,
        category_id: values.category_id,
        payment_method: values.payment_method ?? null,
        transaction_date: values.transaction_date,
        notes: values.notes ?? null,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: "Could not save the transaction." };
    revalidateAll();
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function updateTransaction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return { ok: false, error: "You must be signed in." };

    const parsed = transactionFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstIssue(parsed.error) };
    }
    const values = parsed.data;

    const categoryError = await checkCategory(
      supabase,
      user.id,
      values.category_id,
      values.type,
    );
    if (categoryError) return { ok: false, error: categoryError };

    const { data, error } = await supabase
      .from("transactions")
      .update({
        title: values.title,
        amount: values.amount,
        type: values.type,
        category_id: values.category_id,
        payment_method: values.payment_method ?? null,
        transaction_date: values.transaction_date,
        notes: values.notes ?? null,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: "Could not update the transaction." };
    if (!data) return { ok: false, error: "Transaction not found." };
    revalidateAll();
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return { ok: false, error: "You must be signed in." };

    const { data, error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: "Could not delete the transaction." };
    if (!data) return { ok: false, error: "Transaction not found." };
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Import validated CSV rows. Every row is re-validated server-side
 * (Zod + category check) — the client-side preview is never trusted.
 * Rows already in the database (by dedupe key) and duplicates within
 * the file are skipped, not inserted twice.
 */
export async function importTransactions(
  rows: ImportRowInput[],
): Promise<ImportResult> {
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return { ok: false, error: "You must be signed in." };
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: "No rows to import." };
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        error: `Too many rows — import at most ${MAX_IMPORT_ROWS} at a time.`,
      };
    }

    const [categoriesRes, existingRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, type")
        .or(`user_id.is.null,user_id.eq.${user.id}`),
      supabase
        .from("transactions")
        .select("title, amount, type, category_id, transaction_date")
        .eq("user_id", user.id)
        .limit(10_000),
    ]);
    if (categoriesRes.error || existingRes.error) {
      return { ok: false, error: "Could not load your data for the import." };
    }

    const categoryType = new Map<string, TransactionType>(
      (categoriesRes.data ?? []).map((c) => [c.id, c.type]),
    );
    const existingKeys = new Set(
      (existingRes.data ?? []).map((tx) =>
        dedupeKeyForTransaction(user.id, {
          ...tx,
          id: "",
          user_id: user.id,
          payment_method: null,
          notes: null,
          created_at: "",
          updated_at: "",
        }),
      ),
    );

    const toInsert: {
      rowNumber: number;
      values: {
        user_id: string;
        title: string;
        amount: number;
        type: TransactionType;
        category_id: string;
        payment_method: string | null;
        transaction_date: string;
        notes: string | null;
      };
    }[] = [];
    const seenKeys = new Set<string>();
    const failed: { row: number; reason: string }[] = [];
    let skippedDuplicates = 0;

    for (const row of rows) {
      const parsed = transactionFormSchema.safeParse(row);
      if (!parsed.success) {
        failed.push({ row: row.rowNumber, reason: firstIssue(parsed.error) });
        continue;
      }
      const values = parsed.data;
      const catType = categoryType.get(values.category_id);
      if (!catType) {
        failed.push({ row: row.rowNumber, reason: "Category not found" });
        continue;
      }
      if (catType !== values.type) {
        failed.push({
          row: row.rowNumber,
          reason: `Category is for ${catType} transactions, not ${values.type}`,
        });
        continue;
      }
      const key = dedupeKey({
        userId: user.id,
        title: values.title,
        amountPaise: toPaise(values.amount),
        type: values.type,
        categoryId: values.category_id,
        transaction_date: values.transaction_date,
      });
      if (existingKeys.has(key) || seenKeys.has(key)) {
        skippedDuplicates++;
        continue;
      }
      seenKeys.add(key);
      toInsert.push({
        rowNumber: row.rowNumber,
        values: {
          user_id: user.id,
          title: values.title,
          amount: values.amount,
          type: values.type,
          category_id: values.category_id,
          payment_method: values.payment_method ?? null,
          transaction_date: values.transaction_date,
          notes: values.notes ?? null,
        },
      });
    }

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
      const { data, error } = await supabase
        .from("transactions")
        .insert(chunk.map((item) => item.values))
        .select("id");
      if (error) {
        // Report the whole chunk as failed rather than losing the import.
        for (const item of chunk) {
          failed.push({ row: item.rowNumber, reason: "Could not save this row" });
        }
        continue;
      }
      inserted += data?.length ?? 0;
    }

    if (inserted > 0) revalidateAll();
    return { ok: true, inserted, skippedDuplicates, failed };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
