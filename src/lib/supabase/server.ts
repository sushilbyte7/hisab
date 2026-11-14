import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for Server Components, Server Actions and
 * Route Handlers. Async because `cookies()` is async in Next 16.
 *
 * The publishable key is safe to use here: row access is enforced by
 * Postgres RLS against the authenticated user's JWT, never by the key.
 * No service-role key exists in this codebase.
 */
export async function createClient() {
  // Read cookies FIRST, before checking env vars. During `next build`,
  // prerendering a dashboard route executes this factory; `cookies()` is
  // a dynamic API, so Next bails out of prerendering and marks the route
  // dynamic. If the env check ran first, the plain thrown Error would
  // surface as a build failure instead. At request time cookies() succeeds
  // and the check below throws the clear "not configured" error.
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (see README).",
    );
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // Session refresh is handled by the proxy (src/proxy.ts).
        }
      },
    },
  });
}

/**
 * Require an authenticated user for a server-side operation.
 * Returns the user; throws a redirect-safe error the caller turns into
 * a redirect to /login (Server Components) or an auth error (actions).
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("UNAUTHENTICATED");
  }
  return { supabase, user };
}
