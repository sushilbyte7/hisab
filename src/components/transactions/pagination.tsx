"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  /** Current filter query string WITHOUT the page param. */
  baseQuery: string;
}

/** Page numbers to show: 1, last, and a window around the current page. */
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, 2, total - 1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  baseQuery,
}: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();

  if (totalPages <= 1) return null;

  function goTo(page: number) {
    const params = new URLSearchParams(baseQuery);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {totalItems} transactions
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pageNumbers(currentPage, totalPages).map((p, i) =>
          p === "…" ? (
            <span
              key={`gap-${i}`}
              className="px-1 text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "ghost"}
              size="sm"
              onClick={() => goTo(p)}
              aria-current={p === currentPage ? "page" : undefined}
              className={cn("min-w-9", p === currentPage && "pointer-events-none")}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
