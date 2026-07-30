import { describe, it, expect } from "vitest";
import { buildExpenseImport, expenseTemplateCsv } from "../expenseImport";

const SUBS = ["Building Materials", "Labor", "Roofing", "Kitchen Remodel", "Miscellaneous and Permits"];

const csv = (rows: string[]) => ["Date,Subcategory,Amount,Description,Status", ...rows].join("\n");

describe("buildExpenseImport", () => {
  it("accepts a clean row", () => {
    const r = buildExpenseImport(csv(["2026-07-20,Roofing,9484,New roof,Paid"]), SUBS);
    expect(r.okCount).toBe(1);
    expect(r.rows[0]).toMatchObject({
      ok: true,
      date: "2026-07-20",
      subcategory: "Roofing",
      amount: 9484,
      description: "New roof",
      status: "PAID",
    });
  });

  it("rejects a file missing required columns", () => {
    const r = buildExpenseImport("Date,Amount\n2026-07-20,100", SUBS);
    expect(r.headerError).toMatch(/Subcategory/);
  });

  it("flags an unreadable date but keeps other rows", () => {
    const r = buildExpenseImport(
      csv(["nope,Roofing,100,,", "2026-07-20,Labor,200,,"]),
      SUBS
    );
    expect(r.okCount).toBe(1);
    expect(r.errorCount).toBe(1);
    expect(r.rows[0].error).toMatch(/date/i);
  });

  it("rejects a non-positive amount", () => {
    const r = buildExpenseImport(csv(["2026-07-20,Labor,0,,", "2026-07-20,Labor,-5,,"]), SUBS);
    expect(r.okCount).toBe(0);
    expect(r.rows.every((x) => /positive number/.test(x.error ?? ""))).toBe(true);
  });

  it("strips $ and commas from amounts", () => {
    const r = buildExpenseImport(csv(["2026-07-20,Labor,\"$1,250.50\",,"]), SUBS);
    expect(r.rows[0].amount).toBe(1250.5);
  });

  it("matches subcategory case- and space-insensitively", () => {
    const r = buildExpenseImport(csv(["2026-07-20,  roofing ,100,,"]), SUBS);
    expect(r.rows[0]).toMatchObject({ ok: true, subcategory: "Roofing" });
  });

  it("suggests a close subcategory when it doesn't match exactly", () => {
    const r = buildExpenseImport(csv(["2026-07-20,Kitchen,100,,"]), SUBS);
    expect(r.rows[0].ok).toBe(false);
    expect(r.rows[0].error).toMatch(/Kitchen Remodel/);
  });

  it("defaults a blank status to Pending", () => {
    const r = buildExpenseImport(csv(["2026-07-20,Labor,100,work,"]), SUBS);
    expect(r.rows[0].status).toBe("PENDING");
  });

  it("rejects an unknown status", () => {
    const r = buildExpenseImport(csv(["2026-07-20,Labor,100,work,Overdue"]), SUBS);
    expect(r.rows[0].ok).toBe(false);
    expect(r.rows[0].error).toMatch(/status/i);
  });

  it("skips fully blank lines silently", () => {
    const r = buildExpenseImport(csv(["2026-07-20,Labor,100,,", ",,,,", "   ,,,,"]), SUBS);
    expect(r.rows).toHaveLength(1);
  });

  it("accepts US-style dates via normDate", () => {
    const r = buildExpenseImport(csv(["07/20/2026,Labor,100,,"]), SUBS);
    expect(r.rows[0]).toMatchObject({ ok: true, date: "2026-07-20" });
  });

  it("treats a blank date as needs-a-date, not an error, keeping other fields", () => {
    const r = buildExpenseImport(csv(["  ,Roofing,100,New roof,Paid"]), SUBS);
    expect(r.okCount).toBe(0);
    expect(r.needsDateCount).toBe(1);
    expect(r.errorCount).toBe(0);
    expect(r.rows[0]).toMatchObject({
      ok: false,
      needsDate: true,
      subcategory: "Roofing",
      amount: 100,
      status: "PAID",
    });
    expect(r.rows[0].date).toBeUndefined();
  });

  it("ignores rows missing amount or subcategory by default", () => {
    const r = buildExpenseImport(csv(["2026-07-20,Roofing,,desc,", "2026-07-20,,100,desc,"]), SUBS);
    expect(r.rows).toHaveLength(0);
  });

  it("flags rows missing amount or subcategory when ignoreBlanks is off", () => {
    const r = buildExpenseImport(csv(["2026-07-20,Roofing,,desc,", "2026-07-20,,100,desc,"]), SUBS, {
      ignoreBlanks: false,
    });
    expect(r.okCount).toBe(0);
    expect(r.errorCount).toBe(2);
    expect(r.rows[0].error).toMatch(/amount/i);
    expect(r.rows[1].error).toMatch(/subcategory/i);
  });
});

describe("expenseTemplateCsv", () => {
  it("round-trips: the template's own example rows import cleanly", () => {
    const template = expenseTemplateCsv(SUBS);
    const r = buildExpenseImport(template, SUBS);
    expect(r.headerError).toBeUndefined();
    expect(r.okCount).toBe(2);
    expect(r.errorCount).toBe(0);
  });
});
