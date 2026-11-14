"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, Plus, Search, Upload, X } from "lucide-react";

import type { Category } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { CsvImportDialog } from "@/components/transactions/csv-import-dialog";

export interface TransactionFiltersState {
  q: string;
  type: string;
  category: string;
  payment: string;
  from: string;
  to: string;
  sort: string;
  dir: string;
}

interface TransactionsToolbarProps {
  categories: Category[];
  paymentMethods: string[];
  filters: TransactionFiltersState;
}

const SEARCH_DEBOUNCE_MS = 300;

const SORT_OPTIONS = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Amount: high to low" },
  { value: "amount-asc", label: "Amount: low to high" },
] as const;

export function TransactionsToolbar({
  categories,
  paymentMethods,
  filters,
}: TransactionsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState(filters.q);
  // Keep the input in sync when the URL filter changes from elsewhere
  // (e.g. Clear filters): adjust state during render, not in an effect.
  const [prevQ, setPrevQ] = useState(filters.q);
  if (prevQ !== filters.q) {
    setPrevQ(filters.q);
    setSearch(filters.q);
  }
  const firstRender = useRef(true);

  // Debounced search: push the term into the URL (and reset to page 1).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (search !== filters.q) updateParams({ q: search });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function buildParams(
    updates: Partial<TransactionFiltersState>,
  ): URLSearchParams {
    const next = { ...filters, ...updates };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.type) params.set("type", next.type);
    if (next.category) params.set("category", next.category);
    if (next.payment) params.set("payment", next.payment);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.sort) params.set("sort", next.sort);
    if (next.dir) params.set("dir", next.dir);
    return params;
  }

  // Every filter change drops the page param, resetting to page 1.

  function updateParams(updates: Partial<TransactionFiltersState>) {
    const params = buildParams(updates);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function handleSortChange(value: string) {
    const [sort, dir] = value.split("-");
    updateParams({ sort, dir });
  }

  const hasActiveFilters = Boolean(
    filters.q ||
      filters.type ||
      filters.category ||
      filters.payment ||
      filters.from ||
      filters.to,
  );

  const sortValue = `${filters.sort || "date"}-${filters.dir || "desc"}`;
  const exportHref = `/api/transactions/export?${buildParams({}).toString()}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or notes…"
            className="pl-9"
            aria-label="Search transactions"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <Button variant="outline" asChild>
          <a href={exportHref} download>
            <Download className="size-4" />
            Export CSV
          </a>
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="size-4" />
          Import CSV
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          New transaction
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.type || "all"}
          onValueChange={(v) =>
            updateParams({ type: v === "all" ? "" : v })
          }
        >
          <SelectTrigger className="w-32" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.category || "all"}
          onValueChange={(v) =>
            updateParams({ category: v === "all" ? "" : v })
          }
        >
          <SelectTrigger className="w-44" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.payment || "all"}
          onValueChange={(v) =>
            updateParams({ payment: v === "all" ? "" : v })
          }
        >
          <SelectTrigger className="w-40" aria-label="Filter by payment method">
            <SelectValue placeholder="All methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {paymentMethods.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filters.from}
          onChange={(e) => updateParams({ from: e.target.value })}
          className="w-40"
          aria-label="From date"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => updateParams({ to: e.target.value })}
          className="w-40"
          aria-label="To date"
        />

        <Select value={sortValue} onValueChange={handleSortChange}>
          <SelectTrigger className="w-48" aria-label="Sort transactions">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateParams({
                q: "",
                type: "",
                category: "",
                payment: "",
                from: "",
                to: "",
              })
            }
          >
            <X className="size-4" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        onSaved={() => router.refresh()}
      />
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        categories={categories}
        onImported={() => router.refresh()}
      />
    </div>
  );
}
