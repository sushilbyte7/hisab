"use client";

import Link from "next/link";

/**
 * Root error boundary. Catches errors thrown in layouts (including the
 * dashboard layout), which the (dashboard)/error.tsx boundary cannot
 * catch — an error.tsx only wraps the segment *below* its own layout.
 * Most importantly, this is what renders when Supabase is not
 * configured: the dashboard layout throws the clear "Supabase is not
 * configured" error, and this boundary shows it instead of a blank page.
 *
 * Must render its own <html>/<body>: it replaces the root layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          background: "#101114",
          color: "#F5F5F5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
          Something went wrong
        </h2>
        <p
          style={{
            margin: 0,
            maxWidth: "28rem",
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "#A1A1AA",
          }}
        >
          {error.message ||
            "This page couldn't load. Try again, or head back home."}
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => reset()}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "0.375rem",
              background: "#8B7CFF",
              color: "#fff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              borderRadius: "0.375rem",
              border: "1px solid #27272A",
              color: "#F5F5F5",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Go home
          </Link>
        </div>
      </body>
    </html>
  );
}
