"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  profileFormSchema,
  updatePasswordSchema,
} from "@/lib/validations";

export type SettingsActionResult =
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

/**
 * Save the user's profile row (name, avatar, currency, date format,
 * theme). Upserted rather than updated so a missing profile row — e.g.
 * the signup trigger failed — is repaired instead of silently dropping
 * the save.
 */
export async function updateProfile(
  input: unknown,
): Promise<SettingsActionResult> {
  const parsed = profileFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error) };
  }

  const { supabase, user } = await authedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to update your profile." };
  }

  const { full_name, avatar_url, currency, date_format, theme } = parsed.data;
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: full_name?.trim() ? full_name.trim() : null,
    avatar_url: avatar_url?.trim() ? avatar_url.trim() : null,
    currency,
    date_format,
    theme,
  });

  if (error) {
    return { ok: false, error: `Could not save profile: ${error.message}` };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Change the password. The current password is verified first by
 * signing in with it server-side; only then is the new password set.
 */
export async function updatePassword(
  input: unknown,
): Promise<SettingsActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error) };
  }

  const { supabase, user } = await authedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to change your password." };
  }
  if (!user.email) {
    return {
      ok: false,
      error:
        "Your account has no email address on file, so the current password cannot be verified.",
    };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (signInError) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (updateError) {
    return {
      ok: false,
      error: `Could not update password: ${updateError.message}`,
    };
  }

  return { ok: true };
}

/**
 * Delete all of the user's data and sign them out.
 *
 * NOTE on cascades: the foreign keys from transactions, budgets and
 * categories point at auth.users, so their ON DELETE CASCADE fires
 * when the *auth user* is deleted — not when the profile row is
 * deleted (the profile row has no dependents). The user's rows are
 * therefore deleted explicitly here, in an order that respects the
 * ON DELETE RESTRICT from transactions/budgets to categories
 * (categories go after the rows that reference them).
 *
 * Deleting the Supabase Auth user itself requires a service-role key,
 * which this MVP deliberately does not ship; the profile deletion
 * above plus sign-out is what the UI performs. The auth account
 * remains but holds no data.
 */
export async function deleteAccountData(): Promise<SettingsActionResult> {
  const { supabase, user } = await authedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to delete your data." };
  }

  const { error: transactionsError } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", user.id);
  if (transactionsError) {
    return {
      ok: false,
      error: `Could not delete your transactions: ${transactionsError.message}`,
    };
  }

  const { error: budgetsError } = await supabase
    .from("budgets")
    .delete()
    .eq("user_id", user.id);
  if (budgetsError) {
    return {
      ok: false,
      error: `Could not delete your budgets: ${budgetsError.message}`,
    };
  }

  // Only custom categories have a user_id; system categories are
  // untouched (and RLS would block deleting them anyway).
  const { error: categoriesError } = await supabase
    .from("categories")
    .delete()
    .eq("user_id", user.id);
  if (categoriesError) {
    return {
      ok: false,
      error: `Could not delete your categories: ${categoriesError.message}`,
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", user.id);
  if (profileError) {
    return {
      ok: false,
      error: `Could not delete your profile: ${profileError.message}`,
    };
  }

  await supabase.auth.signOut();
  return { ok: true };
}
