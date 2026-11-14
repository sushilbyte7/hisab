import "server-only";

// Server-only service: profile reads + full data export for Settings.

import { createClient } from "@/lib/supabase/server";
import type {
  Budget,
  Category,
  Profile,
  Transaction,
} from "@/types/database";

/** The user's profile row, or null when no row exists yet. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }
  return data;
}

/** Everything the Settings data export downloads for one user. */
export interface ExportData {
  profile: Profile | null;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}

/**
 * All of the user's rows, for the Settings data export. Categories are
 * the system categories plus the user's own (RLS scopes the read);
 * transactions and budgets are the user's own only.
 */
export async function getExportData(userId: string): Promise<ExportData> {
  const supabase = await createClient();
  const [profile, categories, transactions, budgets] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("*")
      .order("type", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false }),
    supabase
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
  ]);

  if (profile.error) {
    throw new Error(`Failed to export profile: ${profile.error.message}`);
  }
  if (categories.error) {
    throw new Error(
      `Failed to export categories: ${categories.error.message}`,
    );
  }
  if (transactions.error) {
    throw new Error(
      `Failed to export transactions: ${transactions.error.message}`,
    );
  }
  if (budgets.error) {
    throw new Error(`Failed to export budgets: ${budgets.error.message}`);
  }

  return {
    profile: profile.data,
    categories: categories.data ?? [],
    transactions: transactions.data ?? [],
    budgets: budgets.data ?? [],
  };
}
