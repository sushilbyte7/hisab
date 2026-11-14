/**
 * Hisab CSV import/export helpers (PRD §6.5).
 *
 * Pure functions — no Supabase, no I/O — so they run identically in the
 * browser (import preview) and on the server (re-validation in actions).
 *
 * CSV format:
 *   Title,Amount,Type,Category,Payment Method,Transaction Date,Notes
 * Dates are exported as YYYY-MM-DD; imports also accept DD/MM/YYYY.
 */

import type { Category, Transaction, TransactionType } from "@/types/database";
import { fromPaise, toPaise } from "@/lib/finance";

/** Header row used by both import and export. */
export const CSV_HEADERS = [
  "Title",
  "Amount",
  "Type",
  "Category",
  "Payment Method",
  "Transaction Date",
  "Notes",
] as const;

/** Maximum import size enforced by the import dialog (2 MB). */
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Parse CSV text into a header row and data rows.
 * Handles quoted fields, commas and newlines inside quotes, doubled
 * quotes (""), CRLF and LF line endings, and ignores empty trailing
 * lines (and fully-empty lines anywhere).
 */
export function parseCSV(text: string): ParsedCSV {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  const endField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    // Skip fully-empty lines (e.g. a trailing newline).
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && !fieldStarted && field === "") {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }
    if (ch === ",") {
      endField();
      continue;
    }
    if (ch === "\r") {
      // CRLF: swallow the \r, the \n ends the row. A lone \r also ends it.
      if (text[i + 1] !== "\n") endRow();
      continue;
    }
    if (ch === "\n") {
      endRow();
      continue;
    }
    field += ch;
    fieldStarted = true;
  }

  // Flush a final row when the file has no trailing newline.
  if (field !== "" || row.length > 0) endRow();

  if (rows.length === 0) return { headers: [], rows: [] };
  const [headers, ...data] = rows;
  return { headers: headers.map((h) => h.trim()), rows: data };
}

/** Map parsed rows to header-keyed records (missing cells become ""). */
export function rowsToRecords(
  headers: string[],
  rows: string[][],
): Record<string, string>[] {
  return rows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = row[i] ?? "";
    });
    return record;
  });
}

/** A CSV row that passed validation, ready to insert. */
export interface ValidatedTransactionRow {
  title: string;
  /** Rupees, max 2 decimals. */
  amount: number;
  amountPaise: number;
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  paymentMethod: string | null;
  /** Normalised to YYYY-MM-DD. */
  transactionDate: string;
  notes: string | null;
}

export type RowValidationResult =
  | { ok: true; value: ValidatedTransactionRow }
  | { ok: false; errors: string[] };

/** Amounts must be > 0 and fit NUMERIC(12,2) (same cap as the Zod schema). */
const MAX_AMOUNT = 999_999_999.99;

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
  );
}

/**
 * Normalise a date string to YYYY-MM-DD. Accepts YYYY-MM-DD and
 * DD/MM/YYYY (1- or 2-digit day/month). Returns null when invalid.
 */
export function normaliseCsvDate(raw: string): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const [, y, m, d] = iso;
    if (!isRealDate(Number(y), Number(m), Number(d))) return null;
    return value;
  }
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (dmy) {
    const [, d, m, y] = dmy;
    if (!isRealDate(Number(y), Number(m), Number(d))) return null;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/** Look a field up case-insensitively in a header-keyed record. */
function field(record: Record<string, string>, name: string): string {
  const key = Object.keys(record).find(
    (k) => k.trim().toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? "" : record[key].trim();
}

type CategoryRef = Pick<Category, "id" | "name" | "type">;

/**
 * Validate one imported row against the user's categories.
 * Collects every problem (rather than failing fast) so the preview can
 * show all reasons at once.
 */
export function validateTransactionRow(
  row: Record<string, string>,
  categories: CategoryRef[],
): RowValidationResult {
  const errors: string[] = [];

  const title = field(row, "Title");
  if (!title) errors.push("Title is required");

  const amountRaw = field(row, "Amount")
    .replace(/₹/g, "")
    .replace(/rs\.?/gi, "")
    .replace(/,/g, "")
    .trim();
  const amount = Number(amountRaw);
  if (amountRaw === "" || !Number.isFinite(amount)) {
    errors.push(`Amount "${field(row, "Amount")}" is not a number`);
  } else if (amount <= 0) {
    errors.push("Amount must be greater than zero");
  } else if (amount > MAX_AMOUNT) {
    errors.push("Amount is too large");
  } else if (Math.round(amount * 100) !== amount * 100) {
    errors.push("Amount can have at most 2 decimal places");
  }

  const typeRaw = field(row, "Type").toLowerCase();
  const type = typeRaw === "income" || typeRaw === "expense" ? typeRaw : null;
  if (!type) errors.push(`Type must be "income" or "expense"`);

  const categoryName = field(row, "Category");
  const category =
    categoryName === ""
      ? undefined
      : categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!categoryName) {
    errors.push("Category is required");
  } else if (!category) {
    errors.push(`Category "${categoryName}" does not exist`);
  } else if (type && category.type !== type) {
    errors.push(
      `Category "${category.name}" is a ${category.type} category, but the row type is ${type}`,
    );
  }

  const dateRaw = field(row, "Transaction Date");
  const transactionDate = dateRaw === "" ? null : normaliseCsvDate(dateRaw);
  if (!dateRaw) {
    errors.push("Transaction Date is required");
  } else if (!transactionDate) {
    errors.push(
      `Date "${dateRaw}" is not a valid YYYY-MM-DD or DD/MM/YYYY date`,
    );
  }

  const paymentMethod = field(row, "Payment Method");
  const notes = field(row, "Notes");

  if (errors.length > 0) return { ok: false, errors };

  // All guards above passed, so these are non-null here.
  return {
    ok: true,
    value: {
      title,
      amount,
      amountPaise: toPaise(amount),
      type: type as TransactionType,
      categoryId: (category as CategoryRef).id,
      categoryName: (category as CategoryRef).name,
      paymentMethod: paymentMethod === "" ? null : paymentMethod,
      transactionDate: transactionDate as string,
      notes: notes === "" ? null : notes,
    },
  };
}

/** Fields that make up a dedupe key. */
export interface DedupeKeyInput {
  userId: string;
  title: string;
  amountPaise: number;
  type: TransactionType;
  categoryId: string;
  transaction_date: string;
}

/**
 * Deterministic import-dedupe key. Title is normalised (trim + lowercase)
 * so "Groceries" and " groceries " dedupe against each other.
 */
export function dedupeKey(tx: DedupeKeyInput): string {
  return [
    tx.userId,
    tx.title.trim().toLowerCase(),
    tx.amountPaise,
    tx.type,
    tx.categoryId,
    tx.transaction_date,
  ].join("|");
}

/** Build a dedupe key for a transaction already stored in the database. */
export function dedupeKeyForTransaction(
  userId: string,
  tx: Transaction,
): string {
  return dedupeKey({
    userId,
    title: tx.title,
    amountPaise: toPaise(tx.amount),
    type: tx.type,
    categoryId: tx.category_id,
    transaction_date: tx.transaction_date,
  });
}

/** Escape one CSV field per RFC 4180. */
function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export type ExportableTransaction = Pick<
  Transaction,
  | "title"
  | "amount"
  | "type"
  | "payment_method"
  | "transaction_date"
  | "notes"
> & {
  category?: Pick<Category, "name"> | null;
};

/** Serialise transactions to CSV (CRLF line endings, for Excel/Sheets). */
export function transactionsToCSV(
  transactions: ExportableTransaction[],
): string {
  const lines: string[] = [CSV_HEADERS.join(",")];
  for (const tx of transactions) {
    const cells = [
      tx.title,
      fromPaise(toPaise(tx.amount)).toFixed(2),
      tx.type,
      tx.category?.name ?? "",
      tx.payment_method ?? "",
      tx.transaction_date,
      tx.notes ?? "",
    ];
    lines.push(cells.map(escapeField).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
