import { describe, expect, it } from "vitest";
import {
  dedupeKey,
  dedupeKeyForTransaction,
  normaliseCsvDate,
  parseCSV,
  rowsToRecords,
  transactionsToCSV,
  validateTransactionRow,
  type ValidatedTransactionRow,
} from "@/lib/csv";
import type { Category, Transaction } from "@/types/database";

const categories: Pick<Category, "id" | "name" | "type">[] = [
  { id: "cat-food", name: "Food & Dining", type: "expense" },
  { id: "cat-salary", name: "Salary", type: "income" },
  { id: "cat-travel", name: "Travel", type: "expense" },
];

function row(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    Title: "Groceries",
    Amount: "1250.50",
    Type: "expense",
    Category: "Food & Dining",
    "Payment Method": "UPI",
    "Transaction Date": "2026-11-10",
    Notes: "Weekly shop",
    ...overrides,
  };
}

function validValue(
  overrides: Record<string, string> = {},
): ValidatedTransactionRow {
  const result = validateTransactionRow(row(overrides), categories);
  if (!result.ok) throw new Error(`expected valid row: ${result.errors}`);
  return result.value;
}

describe("parseCSV", () => {
  it("parses a simple file with headers and rows", () => {
    const { headers, rows } = parseCSV(
      "Title,Amount,Type\nGroceries,100,expense\nSalary,50000,income\n",
    );
    expect(headers).toEqual(["Title", "Amount", "Type"]);
    expect(rows).toEqual([
      ["Groceries", "100", "expense"],
      ["Salary", "50000", "income"],
    ]);
  });

  it("handles quoted fields with commas inside", () => {
    const { rows } = parseCSV(
      'Title,Notes\n"Hello, world","a, b, c"\n',
    );
    expect(rows).toEqual([["Hello, world", "a, b, c"]]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    const { rows } = parseCSV('Title\n"He said ""hi"""\n');
    expect(rows).toEqual([['He said "hi"']]);
  });

  it("handles newlines inside quoted fields", () => {
    const { rows } = parseCSV('Title,Notes\n"Multi\nline","second"\n');
    expect(rows).toEqual([["Multi\nline", "second"]]);
  });

  it("handles CRLF line endings", () => {
    const { headers, rows } = parseCSV(
      "Title,Amount\r\nGroceries,100\r\nSalary,50000\r\n",
    );
    expect(headers).toEqual(["Title", "Amount"]);
    expect(rows).toEqual([
      ["Groceries", "100"],
      ["Salary", "50000"],
    ]);
  });

  it("ignores empty trailing lines and blank lines", () => {
    const { rows } = parseCSV("Title\nA\n\n\nB\n\n");
    expect(rows).toEqual([["A"], ["B"]]);
  });

  it("parses a file without a trailing newline", () => {
    const { rows } = parseCSV("Title\nA");
    expect(rows).toEqual([["A"]]);
  });

  it("returns empty headers/rows for empty input", () => {
    expect(parseCSV("")).toEqual({ headers: [], rows: [] });
    expect(parseCSV("\n\n")).toEqual({ headers: [], rows: [] });
  });

  it("maps rows to records keyed by header, filling missing cells", () => {
    const { headers, rows } = parseCSV("Title,Amount,Notes\nA,10\n");
    expect(rowsToRecords(headers, rows)).toEqual([
      { Title: "A", Amount: "10", Notes: "" },
    ]);
  });
});

describe("normaliseCsvDate", () => {
  it("passes YYYY-MM-DD through", () => {
    expect(normaliseCsvDate("2026-11-10")).toBe("2026-11-10");
  });

  it("converts DD/MM/YYYY to YYYY-MM-DD", () => {
    expect(normaliseCsvDate("10/11/2026")).toBe("2026-11-10");
    expect(normaliseCsvDate("5/3/2026")).toBe("2026-03-05");
  });

  it("rejects impossible and malformed dates", () => {
    expect(normaliseCsvDate("2026-02-30")).toBeNull();
    expect(normaliseCsvDate("31/02/2026")).toBeNull();
    expect(normaliseCsvDate("11/10/26")).toBeNull();
    expect(normaliseCsvDate("10 Nov 2026")).toBeNull();
    expect(normaliseCsvDate("not a date")).toBeNull();
  });
});

describe("validateTransactionRow", () => {
  it("accepts a fully valid row", () => {
    const value = validValue();
    expect(value).toMatchObject({
      title: "Groceries",
      amount: 1250.5,
      amountPaise: 125050,
      type: "expense",
      categoryId: "cat-food",
      paymentMethod: "UPI",
      transactionDate: "2026-11-10",
      notes: "Weekly shop",
    });
  });

  it("accepts DD/MM/YYYY and converts it", () => {
    const value = validValue({ "Transaction Date": "10/11/2026" });
    expect(value.transactionDate).toBe("2026-11-10");
  });

  it("matches categories case-insensitively and trims fields", () => {
    const value = validValue({
      Title: "  Groceries  ",
      Category: "food & dining",
      Type: "Expense",
    });
    expect(value.title).toBe("Groceries");
    expect(value.categoryId).toBe("cat-food");
  });

  it("treats payment method and notes as optional", () => {
    const value = validValue({ "Payment Method": "", Notes: "" });
    expect(value.paymentMethod).toBeNull();
    expect(value.notes).toBeNull();
  });

  it("accepts amounts with thousand separators and currency symbols", () => {
    expect(validValue({ Amount: "₹1,250.50" }).amount).toBe(1250.5);
    expect(validValue({ Amount: "Rs. 200" }).amount).toBe(200);
  });

  it("rejects a missing title with a reason", () => {
    const result = validateTransactionRow(row({ Title: "  " }), categories);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Title is required");
  });

  it("rejects non-numeric, zero, negative and 3-decimal amounts", () => {
    for (const [amount, match] of [
      ["abc", /not a number/],
      ["0", /greater than zero/],
      ["-50", /greater than zero/],
      ["10.999", /at most 2 decimal places/],
    ] as const) {
      const result = validateTransactionRow(row({ Amount: amount }), categories);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => match.test(e))).toBe(true);
      }
    }
  });

  it("rejects an invalid type with a reason", () => {
    const result = validateTransactionRow(row({ Type: "transfer" }), categories);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('Type must be "income" or "expense"');
    }
  });

  it("rejects an unknown category with a reason", () => {
    const result = validateTransactionRow(
      row({ Category: "Pets" }),
      categories,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('Category "Pets" does not exist');
    }
  });

  it("rejects a category whose type does not match the row type", () => {
    const result = validateTransactionRow(
      row({ Type: "income", Category: "Food & Dining" }),
      categories,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Category "Food & Dining" is a expense category, but the row type is income',
      );
    }
  });

  it("rejects an invalid date with a reason", () => {
    const result = validateTransactionRow(
      row({ "Transaction Date": "2026-13-01" }),
      categories,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/not a valid YYYY-MM-DD/);
    }
  });

  it("collects multiple errors at once", () => {
    const result = validateTransactionRow(
      row({ Title: "", Amount: "x", Type: "nope", Category: "Missing" }),
      categories,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe("dedupeKey", () => {
  const base = {
    userId: "user-1",
    title: "Groceries",
    amountPaise: 125050,
    type: "expense" as const,
    categoryId: "cat-food",
    transaction_date: "2026-11-10",
  };

  it("is stable for the same input", () => {
    expect(dedupeKey(base)).toBe(dedupeKey({ ...base }));
    expect(dedupeKey(base)).toBe(
      "user-1|groceries|125050|expense|cat-food|2026-11-10",
    );
  });

  it("normalises title case and whitespace", () => {
    expect(dedupeKey({ ...base, title: "  GROCERIES " })).toBe(dedupeKey(base));
  });

  it("changes when any component changes", () => {
    expect(dedupeKey({ ...base, amountPaise: 125051 })).not.toBe(dedupeKey(base));
    expect(dedupeKey({ ...base, type: "income" })).not.toBe(dedupeKey(base));
    expect(dedupeKey({ ...base, transaction_date: "2026-11-11" })).not.toBe(
      dedupeKey(base),
    );
    expect(dedupeKey({ ...base, userId: "user-2" })).not.toBe(dedupeKey(base));
  });

  it("matches the key built from a stored transaction", () => {
    const tx = {
      id: "tx-1",
      user_id: "user-1",
      category_id: "cat-food",
      title: "Groceries",
      amount: "1250.50",
      type: "expense",
      payment_method: null,
      transaction_date: "2026-11-10",
      notes: null,
      created_at: "",
      updated_at: "",
    } satisfies Transaction;
    expect(dedupeKeyForTransaction("user-1", tx)).toBe(dedupeKey(base));
  });
});

describe("transactionsToCSV", () => {
  it("writes the header row and one row per transaction", () => {
    const csv = transactionsToCSV([
      {
        title: "Groceries",
        amount: 1250.5,
        type: "expense",
        category: { name: "Food & Dining" },
        payment_method: "UPI",
        transaction_date: "2026-11-10",
        notes: null,
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Title,Amount,Type,Category,Payment Method,Transaction Date,Notes",
    );
    expect(lines[1]).toBe(
      "Groceries,1250.50,expense,Food & Dining,UPI,2026-11-10,",
    );
  });

  it("escapes commas, quotes and newlines in fields", () => {
    const csv = transactionsToCSV([
      {
        title: 'Lunch, "team" outing',
        amount: "99.9",
        type: "expense",
        category: { name: "Food & Dining" },
        payment_method: null,
        transaction_date: "2026-11-11",
        notes: "line one\nline two",
      },
    ]);
    expect(csv).toContain('"Lunch, ""team"" outing",99.90,expense');
    expect(csv).toContain('"line one\nline two"');
  });

  it("round-trips through parseCSV", () => {
    const tx = {
      title: "Café, brunch",
      amount: 450,
      type: "expense" as const,
      category: { name: "Food & Dining" },
      payment_method: "Card",
      transaction_date: "2026-11-12",
      notes: 'with "friends"',
    };
    const { headers, rows } = parseCSV(transactionsToCSV([tx]));
    const [record] = rowsToRecords(headers, rows);
    expect(record["Title"]).toBe("Café, brunch");
    expect(record["Notes"]).toBe('with "friends"');
    expect(record["Amount"]).toBe("450.00");
  });
});
