"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-4 px-4 text-center">
      <TriangleAlert className="size-10 text-destructive" aria-hidden />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {error.message ||
          "This page couldn't load. Try again, or head back to the dashboard."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
