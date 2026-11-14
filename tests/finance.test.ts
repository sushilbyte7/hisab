import { describe, expect, it } from "vitest";
import {
  budgetRemaining,
  budgetStatus,
  budgetUtilization,
  formatCurrency,
  formatDate,
  getPeriodRange,
  getPreviousPeriodRange,
  netBalance,
  parseLocalDate,
  percentChange,
  savingsAmount,
  savingsRate,
  sumAmounts,
  toISODate,
  toPaise,
} from "@/lib/finance";

describe("toPaise / sumAmounts", () => {
  it("converts rupees to integer paise, including string input", () => {
    expect(toPaise(10.5)).toBe(1050);
    expect(toPaise("10.50")).toBe(1050);
    expect(toPaise(0.1)).toBe(10);
  });

  it("sums without floating-point drift (0.1 + 0.2 = 0.3)", () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts(["100.10", 200.2, 0.7])).toBe(301);
  });

  it("throws on invalid amounts", () => {
    expect(() => toPaise("abc")).toThrow();
    expect(() => toPaise(Number.NaN)).toThrow();
  });
});

describe("netBalance / savingsAmount", () => {
  it("income minus expenses", () => {
    expect(netBalance(50_000, 32_000)).toBe(18_000);
    expect(netBalance(10_000, 12_000)).toBe(-2_000);
    expect(netBalance(0, 0)).toBe(0);
  });

  it("savings equals net balance", () => {
    expect(savingsAmount(50_000, 32_000)).toBe(18_000);
  });
});

describe("savingsRate", () => {
  it("computes (income - expenses) / income * 100", () => {
    expect(savingsRate(50_000, 32_000)).toBe(36);
    expect(savingsRate(10_000, 10_000)).toBe(0);
    expect(savingsRate(10_000, 12_000)).toBe(-20);
  });

  it("returns null on zero income (no division by zero)", () => {
    expect(savingsRate(0, 0)).toBeNull();
    expect(savingsRate(0, 500)).toBeNull();
    expect(savingsRate("0", "0")).toBeNull();
  });

  it("rounds to 2 decimals", () => {
    expect(savingsRate(3, 1)).toBe(66.67);
  });
});

describe("budgetRemaining / budgetUtilization / budgetStatus", () => {
  it("remaining = budget - spent, can go negative", () => {
    expect(budgetRemaining(5_000, 3_500)).toBe(1_500);
    expect(budgetRemaining(2_000, 2_400)).toBe(-400);
    expect(budgetRemaining(3_000, 0)).toBe(3_000);
  });

  it("utilization = spent / budget * 100", () => {
    expect(budgetUtilization(5_000, 3_500)).toBe(70);
    expect(budgetUtilization(2_000, 2_400)).toBe(120);
    expect(budgetUtilization(3_000, 0)).toBe(0);
  });

  it("returns 0 utilization for a zero budget", () => {
    expect(budgetUtilization(0, 100)).toBe(0);
  });

  it("status bands: ok < 80, warning 80-99.99, exceeded >= 100", () => {
    expect(budgetStatus(0)).toBe("ok");
    expect(budgetStatus(79.99)).toBe("ok");
    expect(budgetStatus(80)).toBe("warning");
    expect(budgetStatus(99.99)).toBe("warning");
    expect(budgetStatus(100)).toBe("exceeded");
    expect(budgetStatus(150)).toBe("exceeded");
  });
});

describe("formatCurrency", () => {
  it("formats INR with en-IN grouping", () => {
    expect(formatCurrency(150000)).toBe("₹1,50,000.00");
    expect(formatCurrency("99.5")).toBe("₹99.50");
    expect(formatCurrency(-400)).toBe("-₹400.00");
  });
});

describe("formatDate / parseLocalDate", () => {
  it("formats per the user's date-format preference", () => {
    expect(formatDate("2026-11-14", "DD/MM/YYYY")).toBe("14/11/2026");
    expect(formatDate("2026-11-14", "MM/DD/YYYY")).toBe("11/14/2026");
    expect(formatDate("2026-11-14", "YYYY-MM-DD")).toBe("2026-11-14");
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
  });

  it("parses YYYY-MM-DD in local time (no UTC day shift)", () => {
    const d = parseLocalDate("2026-11-14");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(14);
    expect(toISODate(d)).toBe("2026-11-14");
  });
});

describe("getPeriodRange", () => {
  const now = new Date(2026, 10, 14); // 14 Nov 2026 (local)

  it("week = last 7 days including today", () => {
    expect(getPeriodRange("week", undefined, now)).toEqual({
      from: "2026-11-08",
      to: "2026-11-14",
    });
  });

  it("month = current calendar month", () => {
    expect(getPeriodRange("month", undefined, now)).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });

  it("year = current calendar year", () => {
    expect(getPeriodRange("year", undefined, now)).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("custom range passes through and rejects reversed ranges", () => {
    expect(
      getPeriodRange("custom", { from: "2026-01-01", to: "2026-01-31" }, now),
    ).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(() =>
      getPeriodRange("custom", { from: "2026-02-01", to: "2026-01-01" }, now),
    ).toThrow();
    expect(() => getPeriodRange("custom", undefined, now)).toThrow();
  });
});

describe("getPreviousPeriodRange", () => {
  it("returns the immediately preceding range of the same length", () => {
    expect(
      getPreviousPeriodRange({ from: "2026-11-01", to: "2026-11-30" }),
    ).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(
      getPreviousPeriodRange({ from: "2026-11-08", to: "2026-11-14" }),
    ).toEqual({ from: "2026-11-01", to: "2026-11-07" });
  });
});

describe("percentChange", () => {
  it("computes change vs the previous value", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
  });

  it("returns null when the previous value is 0", () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});
