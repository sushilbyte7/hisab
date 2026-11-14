import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// NOTE: no `export const dynamic = "force-dynamic"` here — that segment
// config is incompatible with `cacheComponents` (Next 16). This handler
// is dynamic anyway because it reads cookies() via the server client.

/**
 * Handles Supabase auth redirects: email verification, password
 * recovery and OAuth. Exchanges the `code` for a session, then sends
 * the user on to `?next=` (default /dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const loginWithError = (message: string) => {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", message);
    return NextResponse.redirect(loginUrl);
  };

  // Supabase itself reports the failure (e.g. expired/used link).
  if (error) {
    return loginWithError(errorDescription ?? error);
  }

  // Recovery links must land on the reset form, whatever `next` says.
  let next = searchParams.get("next") ?? "/dashboard";
  if (type === "recovery") next = "/reset-password";
  // Only allow same-origin relative destinations (no open redirects).
  if (!next.startsWith("/") || next.startsWith("//")) next = "/dashboard";

  if (!code) {
    return loginWithError("Invalid or expired link. Please try again.");
  }

  try {
    const supabase = await createClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return loginWithError(exchangeError.message);
    }
  } catch (err) {
    return loginWithError(
      err instanceof Error ? err.message : "Could not sign you in.",
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
