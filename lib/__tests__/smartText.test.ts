import { describe, it, expect } from "vitest";
import { parseSmartText } from "../smartText";
import { buildExpenseImport } from "../expenseImport";

const SUBS = [
  "Purchase Price",
  "Building Materials",
  "Labor",
  "Roofing",
  "Plumbing",
  "Electrical",
  "Demolition and Site Prep",
  "Kitchen Remodel",
  "Interior Doors and Millwork",
  "Miscellaneous and Permits",
  "Insurance",
  "Property Tax",
];

// Parse text -> CSV -> the real import result, and index rows by line for asserts.
function rowsFrom(text: string) {
  const csv = parseSmartText(text, SUBS);
  return buildExpenseImport(csv, SUBS, { ignoreBlanks: true }).rows;
}

describe("parseSmartText", () => {
  it("maps a dollar amount, M/D date (current year), category, and Paid status", () => {
    const r = rowsFrom("8/14 home depot lumber $340 paid");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ ok: true, subcategory: "Building Materials", amount: 340, status: "PAID" });
    expect(r[0].date).toMatch(/^\d{4}-08-14$/);
  });

  it("treats a line with no date as needs-a-date, keeping the rest", () => {
    const r = rowsFrom("plumbing parts 85");
    expect(r[0]).toMatchObject({ needsDate: true, subcategory: "Plumbing", amount: 85, status: "PENDING" });
  });

  it("reads a Reimbursed status and a $ amount with a thousands comma", () => {
    const r = rowsFrom("Electrician labor $1,200 reimbursed");
    // "labor" is an exact category name, so it wins the mapping.
    expect(r[0]).toMatchObject({ ok: false, needsDate: true, subcategory: "Labor", amount: 1200, status: "REIMBURSED" });
  });

  it("maps trade keywords to real subcategories", () => {
    expect(rowsFrom("Dumpster rental 500")[0].subcategory).toBe("Demolition and Site Prep");
    expect(rowsFrom("Rewire panel 900")[0].subcategory).toBe("Electrical");
    expect(rowsFrom("New roof 9000")[0].subcategory).toBe("Roofing");
  });

  it("falls back to Miscellaneous and Permits when nothing matches", () => {
    expect(rowsFrom("Notary run 25")[0].subcategory).toBe("Miscellaneous and Permits");
  });

  it("parses an ISO date", () => {
    const r = rowsFrom("2026-01-05 insurance premium 1200");
    expect(r[0]).toMatchObject({ ok: true, date: "2026-01-05", subcategory: "Insurance", amount: 1200 });
  });

  it("picks the largest number as the amount, ignoring quantities", () => {
    const r = rowsFrom("2 interior doors 340");
    expect(r[0]).toMatchObject({ subcategory: "Interior Doors and Millwork", amount: 340 });
  });

  it("handles multiple lines, one expense each", () => {
    const r = rowsFrom("Dumpster 500\nRoof repair 2/3/2025 900\nplumbing 85");
    expect(r).toHaveLength(3);
  });

  it("produces a clean description with the amount/date/status stripped out", () => {
    const r = rowsFrom("Paid roofing $500");
    expect(r[0].description).toBe("roofing");
  });
});
