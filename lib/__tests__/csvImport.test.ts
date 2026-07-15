import { describe, expect, it } from "vitest";
import { parseCSV, detectColumns, detectSign, normAmount, normDate, buildImport, importHash } from "../csvImport";

describe("parseCSV", () => {
  it("handles embedded commas, quotes, and a BOM", () => {
    const text = '﻿Date,Description,Amount\n2026-07-09,"HOME DEPOT #6832, FREMONT CA",3184.22\n';
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["Date", "Description", "Amount"],
      ["2026-07-09", "HOME DEPOT #6832, FREMONT CA", "3184.22"],
    ]);
  });

  it('unescapes doubled quotes ("")', () => {
    const rows = parseCSV('Description\n"Bob""s Hardware"\n');
    expect(rows[1][0]).toBe('Bob"s Hardware');
  });

  it("drops blank lines", () => {
    const rows = parseCSV("a,b\n\n1,2\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("detectColumns — spec §6a (Chase Details vs Description)", () => {
  it("picks the real Description column, not Details (which holds DEBIT/CREDIT)", () => {
    const header = ["Details", "Posting Date", "Description", "Amount", "Type", "Balance"];
    const map = detectColumns(header);
    expect(map.desc).toBe(2); // "Description", not 0 ("Details")
    expect(map.date).toBe(1);
    expect(map.amount).toBe(3);
  });

  it("never claims the same column for two fields", () => {
    const header = ["Date", "Amount"];
    const map = detectColumns(header);
    const claimed = Object.values(map).filter((v) => v != null);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("falls back to substring matching when no exact header matches", () => {
    const header = ["Transaction Date", "Merchant", "Transaction Amount"];
    const map = detectColumns(header);
    expect(map.date).toBe(0);
    expect(map.desc).toBe(1);
    expect(map.amount).toBe(2);
  });
});

describe("detectSign — spec §6b (Amex positive charges vs Chase negative debits)", () => {
  it("detects a card-style export (all positive) and flips", () => {
    const map = detectColumns(["Date", "Description", "Amount"]);
    const body = [
      ["2026-07-01", "a", "100.00"],
      ["2026-07-02", "b", "50.00"],
    ];
    expect(detectSign(body, map)).toBe(true);
  });

  it("does not flip a normal bank export with negative debits", () => {
    const map = detectColumns(["Date", "Description", "Amount"]);
    const body = [
      ["2026-07-01", "a", "-100.00"],
      ["2026-07-02", "b", "-50.00"],
    ];
    expect(detectSign(body, map)).toBe(false);
  });

  it("does not flip when a debit/credit split already exists", () => {
    const map = detectColumns(["Date", "Description", "Debit", "Credit"]);
    expect(detectSign([["2026-07-01", "a", "100.00", ""]], map)).toBe(false);
  });
});

describe("normAmount", () => {
  const map = detectColumns(["Date", "Description", "Amount"]);

  it("treats negative as a debit when not flipped (bank-style)", () => {
    expect(normAmount(["2026-07-01", "a", "-42.50"], map, false)).toBe(42.5);
  });

  it("skips positive rows (deposits) when not flipped", () => {
    expect(normAmount(["2026-07-01", "a", "42.50"], map, false)).toBeNull();
  });

  it("treats positive as a charge when flipped (card-style)", () => {
    expect(normAmount(["2026-07-01", "a", "42.50"], map, true)).toBe(42.5);
  });

  it("skips negative rows (payments/credits) when flipped", () => {
    expect(normAmount(["2026-07-01", "a", "-42.50"], map, true)).toBeNull();
  });

  it("handles accounting-style negative parens", () => {
    expect(normAmount(["2026-07-01", "a", "(42.50)"], map, false)).toBe(42.5);
  });

  it("uses the debit column directly, ignoring sign detection entirely", () => {
    const debitMap = detectColumns(["Date", "Description", "Debit", "Credit"]);
    expect(normAmount(["2026-07-01", "a", "42.50", ""], debitMap, false)).toBe(42.5);
    expect(normAmount(["2026-07-01", "a", "", "42.50"], debitMap, false)).toBeNull();
  });
});

describe("normDate", () => {
  it("normalizes US m/d/y", () => expect(normDate("7/9/2026")).toBe("2026-07-09"));
  it("normalizes ISO already", () => expect(normDate("2026-07-09")).toBe("2026-07-09"));
  it("normalizes 2-digit year", () => expect(normDate("7/9/26")).toBe("2026-07-09"));
  it("returns empty string for garbage", () => expect(normDate("not a date")).toBe(""));
});

describe("buildImport — spec §6c/§6d end to end", () => {
  it("imports a Chase-style export correctly despite the Details/Description trap", () => {
    const csv = [
      "Details,Posting Date,Description,Amount,Type,Balance",
      'DEBIT,07/09/2026,"HOME DEPOT #6832, FREMONT CA",-3184.22,DEBIT_CARD,10000.00',
      "DEBIT,07/08/2026,SIERRA ROOFING SUPPLY,-6420.00,ACH_DEBIT,13184.22",
      "CREDIT,07/05/2026,PAYROLL DEPOSIT,5000.00,ACH_CREDIT,19604.22",
    ].join("\n");

    const result = buildImport(csv, new Set());
    expect(result.needsMapping).toBeFalsy();
    expect(result.fresh).toBe(2); // the deposit is skipped
    expect(result.skips).toBe(1);
    const first = result.items.find((i) => i.status === "fresh");
    // Must have picked "Description", not "Details" (which would read "DEBIT").
    expect(first?.description).toBe("HOME DEPOT #6832, FREMONT CA");
    expect(first?.description).not.toBe("DEBIT");
  });

  it("imports an Amex-style export (positive = charge) without silently dropping every row", () => {
    const csv = ["Date,Description,Amount", "07/09/2026,SIERRA ROOFING SUPPLY,6420.00", "07/08/2026,HOME DEPOT,3184.22"].join(
      "\n"
    );
    const result = buildImport(csv, new Set());
    expect(result.fresh).toBe(2);
    expect(result.skips).toBe(0);
  });

  it("flags re-imported rows as duplicates via the same key used for BankTxn.importHash", () => {
    const csv = ["Date,Description,Amount", "07/09/2026,HOME DEPOT,-100.00"].join("\n");
    const existingHash = importHash("2026-07-09", 100, "HOME DEPOT");
    const result = buildImport(csv, new Set([existingHash]));
    expect(result.dupes).toBe(1);
    expect(result.fresh).toBe(0);
  });

  it("deduplicates within the same file, not just against existing rows", () => {
    const csv = [
      "Date,Description,Amount",
      "07/09/2026,HOME DEPOT,-100.00",
      "07/09/2026,HOME DEPOT,-100.00",
    ].join("\n");
    const result = buildImport(csv, new Set());
    expect(result.fresh).toBe(1);
    expect(result.dupes).toBe(1);
  });

  it("requests column mapping when headers aren't recognized", () => {
    const csv = ["Col1,Col2,Col3", "foo,bar,baz"].join("\n");
    const result = buildImport(csv, new Set());
    expect(result.needsMapping).toBe(true);
    expect(result.header).toEqual(["Col1", "Col2", "Col3"]);
  });
});
