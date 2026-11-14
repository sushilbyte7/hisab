"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";

import {
  dedupeKey,
  MAX_CSV_BYTES,
  parseCSV,
  rowsToRecords,
  validateTransactionRow,
  type RowValidationResult,
} from "@/lib/csv";
import { formatCurrency } from "@/lib/finance";
import type { Category } from "@/types/database";
import {
  importTransactions,
  type ImportRowInput,
} from "@/app/(dashboard)/transactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PREVIEW_ROWS = 10;
const MAX_IMPORT_ROWS = 1000;

const REQUIRED_HEADERS = [
  "Title",
  "Amount",
  "Type",
  "Category",
  "Transaction Date",
];

interface ParsedRow {
  /** CSV line number (header is line 1). */
  lineNumber: number;
  record: Record<string, string>;
  result: RowValidationResult;
  duplicateInFile: boolean;
}

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onImported?: () => void;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  categories,
  onImported,
}: CsvImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    skippedDuplicates: number;
    failed: { row: number; reason: string }[];
  } | null>(null);

  function reset() {
    setFileName(null);
    setRows(null);
    setParseError(null);
    setImporting(false);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      setParseError("File is too large — CSV imports are limited to 2 MB.");
      return;
    }
    setFileName(file.name);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setParseError("Could not read that file.");
      return;
    }
    const { headers, rows: rawRows } = parseCSV(text);
    if (headers.length === 0) {
      setParseError("The file appears to be empty.");
      return;
    }
    const missing = REQUIRED_HEADERS.filter(
      (h) => !headers.some((x) => x.toLowerCase() === h.toLowerCase()),
    );
    if (missing.length > 0) {
      setParseError(
        `Missing required column(s): ${missing.join(", ")}. Expected header: ${REQUIRED_HEADERS.join(", ")} (+ optional Payment Method, Notes).`,
      );
      return;
    }
    const records = rowsToRecords(headers, rawRows);
    const seenKeys = new Set<string>();
    const parsed: ParsedRow[] = records.map((record, i) => {
      const result = validateTransactionRow(record, categories);
      let duplicateInFile = false;
      if (result.ok) {
        // Within-file dedupe: userId is the same for every row, so a
        // placeholder keeps the comparison valid without knowing it here.
        const key = dedupeKey({
          userId: "",
          title: result.value.title,
          amountPaise: result.value.amountPaise,
          type: result.value.type,
          categoryId: result.value.categoryId,
          transaction_date: result.value.transactionDate,
        });
        duplicateInFile = seenKeys.has(key);
        seenKeys.add(key);
      }
      return { lineNumber: i + 2, record, result, duplicateInFile };
    });
    setRows(parsed);
  }

  type ValidParsedRow = ParsedRow & {
    result: Extract<RowValidationResult, { ok: true }>;
  };
  const validRows = (rows ?? []).filter(
    (r): r is ValidParsedRow => r.result.ok && !r.duplicateInFile,
  );
  const invalidRows = (rows ?? []).filter((r) => !r.result.ok);
  const duplicateRows = (rows ?? []).filter(
    (r) => r.result.ok && r.duplicateInFile,
  );
  const importable = validRows.slice(0, MAX_IMPORT_ROWS);

  async function handleImport() {
    if (importable.length === 0) return;
    setImporting(true);
    const payload: ImportRowInput[] = importable.map((r) => ({
      rowNumber: r.lineNumber,
      title: r.result.value.title,
      amount: r.result.value.amount,
      type: r.result.value.type,
      category_id: r.result.value.categoryId,
      payment_method: r.result.value.paymentMethod,
      transaction_date: r.result.value.transactionDate,
      notes: r.result.value.notes,
    }));
    const result = await importTransactions(payload);
    setImporting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setImportResult(result);
    if (result.inserted > 0) {
      toast.success(`Imported ${result.inserted} transaction(s)`);
      onImported?.();
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Import transactions from CSV</DialogTitle>
          <DialogDescription>
            Columns: Title, Amount, Type (income/expense), Category, Payment
            Method (optional), Transaction Date (YYYY-MM-DD or DD/MM/YYYY),
            Notes (optional). Max 2 MB. Rows already in Hisab are skipped
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void handleFile(e.target.files?.[0])}
              disabled={importing}
            />
          </div>

          {parseError ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {parseError}
            </p>
          ) : null}

          {importResult ? (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p className="font-medium">Import complete</p>
              <p>
                Inserted{" "}
                <span className="font-medium text-green-600 dark:text-green-400">
                  {importResult.inserted}
                </span>
                {importResult.skippedDuplicates > 0 ? (
                  <>
                    {" · "}skipped{" "}
                    <span className="font-medium">
                      {importResult.skippedDuplicates}
                    </span>{" "}
                    duplicate(s) already in Hisab
                  </>
                ) : null}
                {importResult.failed.length > 0 ? (
                  <>
                    {" · "}
                    <span className="font-medium text-destructive">
                      {importResult.failed.length} failed
                    </span>
                  </>
                ) : null}
              </p>
              {importResult.failed.length > 0 ? (
                <ul className="max-h-32 space-y-1 overflow-y-auto text-muted-foreground">
                  {importResult.failed.map((f) => (
                    <li key={f.row}>
                      Row {f.row}: {f.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {rows && !importResult ? (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">
                  {validRows.length} valid
                </Badge>
                {duplicateRows.length > 0 ? (
                  <Badge variant="outline">
                    {duplicateRows.length} duplicate in file
                  </Badge>
                ) : null}
                {invalidRows.length > 0 ? (
                  <Badge variant="destructive">
                    {invalidRows.length} invalid
                  </Badge>
                ) : null}
                {validRows.length > MAX_IMPORT_ROWS ? (
                  <Badge variant="outline">
                    Only the first {MAX_IMPORT_ROWS} valid rows will be
                    imported
                  </Badge>
                ) : null}
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, PREVIEW_ROWS).map((r) => (
                      <TableRow key={r.lineNumber}>
                        <TableCell className="text-muted-foreground">
                          {r.lineNumber}
                        </TableCell>
                        <TableCell className="max-w-40 truncate">
                          {r.record["Title"] || r.record["title"] || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {r.result.ok
                            ? formatCurrency(r.result.value.amount)
                            : (r.record["Amount"] ?? "—")}
                        </TableCell>
                        <TableCell>{r.record["Type"] || "—"}</TableCell>
                        <TableCell className="max-w-32 truncate">
                          {r.record["Category"] || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.result.ok
                            ? r.result.value.transactionDate
                            : (r.record["Transaction Date"] ?? "—")}
                        </TableCell>
                        <TableCell>
                          {r.result.ok ? (
                            r.duplicateInFile ? (
                              <Badge variant="outline">
                                Duplicate in file
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Valid</Badge>
                            )
                          ) : (
                            <span className="text-xs text-destructive">
                              {r.result.errors.join("; ")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > PREVIEW_ROWS ? (
                <p className="text-xs text-muted-foreground">
                  Showing first {PREVIEW_ROWS} of {rows.length} rows
                  {fileName ? ` from ${fileName}` : ""}.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            {importResult ? "Done" : "Cancel"}
          </Button>
          {!importResult && rows ? (
            <Button
              onClick={() => void handleImport()}
              disabled={importing || importable.length === 0}
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}
              Import {importable.length} valid transaction
              {importable.length === 1 ? "" : "s"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
