import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { transactionsToCSV } from "@/lib/csv";
import { toISODate } from "@/lib/finance";
import type { TransactionType } from "@/types/database";
import { listTransactions } from "@/services/transactions";

/** Max rows a single export returns. */
const EXPORT_ROW_LIMIT = 10_000;

function asType(value: string | null): TransactionType | undefined {
  return value === "income" || value === "expense" ? value : undefined;
}

/**
 * GET /api/transactions/export — download the filtered transaction list
 * as CSV. Accepts the same filter query params as /transactions
 * (q, type, category, payment, from, to, sort, dir).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const { data } = await listTransactions({
    userId: user.id,
    search: params.get("q") ?? undefined,
    type: asType(params.get("type")),
    categoryId: params.get("category") ?? undefined,
    paymentMethod: params.get("payment") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    sortBy: params.get("sort") === "amount" ? "amount" : "date",
    sortDir: params.get("dir") === "asc" ? "asc" : "desc",
    page: 1,
    pageSize: EXPORT_ROW_LIMIT,
  });

  const csv = transactionsToCSV(data);
  const filename = `hisab-transactions-${toISODate(new Date())}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
