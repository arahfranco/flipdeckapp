import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { computeProperty, type BudgetLineInput, type ExpenseInput, type PayrollInput } from "../calc";

const D = (n: number) => new Prisma.Decimal(n);

function budgetLine(overrides: Partial<BudgetLineInput> & { subcategory: string }): BudgetLineInput {
  return {
    id: overrides.id ?? overrides.subcategory,
    category: "Rehab Costs",
    estimated: D(0),
    actual: D(0),
    ...overrides,
  };
}

describe("computeProperty — rollup precedence (spec §2, rule 2)", () => {
  it("uses the expense-log sum as the actual when an expense exists for the subcategory", () => {
    const budget = [budgetLine({ subcategory: "Roofing", category: "Rehab Costs", estimated: D(26000), actual: D(999999) })];
    const expenses: ExpenseInput[] = [{ subcategory: "Roofing", amount: D(24900) }];

    const result = computeProperty(budget, expenses, []);
    const row = result.byCat["Rehab Costs"].rows.find((r) => r.subcategory === "Roofing")!;

    // Must equal the expense sum, NOT budget.actual, and NOT the sum of both (no double-counting).
    expect(row.actual.toNumber()).toBe(24900);
  });

  it("sums multiple expense entries for the same subcategory before overriding", () => {
    const budget = [budgetLine({ subcategory: "Plumbing", estimated: D(19000) })];
    const expenses: ExpenseInput[] = [
      { subcategory: "Plumbing", amount: D(10000) },
      { subcategory: "Plumbing", amount: D(8200) },
    ];

    const result = computeProperty(budget, expenses, []);
    const row = result.byCat["Rehab Costs"].rows.find((r) => r.subcategory === "Plumbing")!;
    expect(row.actual.toNumber()).toBe(18200);
  });

  it("is $0 for a cost line with no expense entries, ignoring any stale stored actual", () => {
    // A cost line's stored `actual` is never trusted as a fallback — only the
    // expense log can set it. Otherwise leftover data (e.g. from a property
    // that was repurposed for a new deal) would silently reappear as if it
    // were real, which is exactly the bug this guards against.
    const budget = [
      budgetLine({ subcategory: "Insurance", category: "Holding Costs", estimated: D(4200), actual: D(2100) }),
    ];

    const result = computeProperty(budget, [], []);
    const row = result.byCat["Holding Costs"].rows.find((r) => r.subcategory === "Insurance")!;
    expect(row.actual.toNumber()).toBe(0);
  });

  it("Sale Price is the one exception: its stored actual is used directly (no expense-log equivalent for revenue)", () => {
    const budget = [
      budgetLine({ subcategory: "Sale Price", category: "Selling Price", estimated: D(700000), actual: D(680000) }),
    ];

    const result = computeProperty(budget, [], []);
    const row = result.byCat["Selling Price"].rows.find((r) => r.subcategory === "Sale Price")!;
    expect(row.actual.toNumber()).toBe(680000);
  });
});

describe("computeProperty — Labor (Payroll) synthetic line (spec §2, rule 3)", () => {
  it("computes sum(hours × rate) as the Labor line's actual, with estimated 0", () => {
    const payroll: PayrollInput[] = [
      { hours: D(48), rate: D(60) },
      { hours: D(44), rate: D(45) },
    ];

    const result = computeProperty([], [], payroll);
    const labor = result.byCat["Rehab Costs"].rows.find((r) => r.subcategory === "Labor (Payroll)");

    expect(labor).toBeDefined();
    expect(labor!.actual.toNumber()).toBe(48 * 60 + 44 * 45);
    expect(labor!.estimated.toNumber()).toBe(0);
    expect(labor!.derived).toBe(true);
  });

  it("does not add a Labor line when there is no payroll", () => {
    const result = computeProperty([], [], []);
    const labor = result.byCat["Rehab Costs"].rows.find((r) => r.subcategory === "Labor (Payroll)");
    expect(labor).toBeUndefined();
  });
});

describe("computeProperty — profit basis switch (spec §2)", () => {
  // Actual costs now come from real expense-log entries, not a stored
  // fallback — same dollar totals as before (500000 + 18000 = 518000),
  // just derived the way the app actually derives them.
  const costBudget: BudgetLineInput[] = [
    budgetLine({ subcategory: "Purchase Price", category: "Purchase Costs", estimated: D(500000) }),
    budgetLine({ subcategory: "Roofing", category: "Rehab Costs", estimated: D(20000) }),
  ];
  const costExpenses: ExpenseInput[] = [
    { subcategory: "Purchase Price", amount: D(500000) },
    { subcategory: "Roofing", amount: D(18000) },
  ];

  it("uses the ESTIMATED sale price as the basis before the property sells", () => {
    const budget = [...costBudget, budgetLine({ subcategory: "Sale Price", category: "Selling Price", estimated: D(700000), actual: D(0) })];

    const result = computeProperty(budget, costExpenses, []);
    expect(result.sold).toBe(false);
    expect(result.priceBasis.toNumber()).toBe(700000);
    // total actual cost = 500000 + 18000 = 518000; profit against the TARGET price, not a loss.
    expect(result.actProfit.toNumber()).toBe(700000 - 518000);
    expect(result.actProfit.toNumber()).toBeGreaterThan(0);
  });

  it("switches to the ACTUAL sale price as the basis once the property sells", () => {
    const budget = [...costBudget, budgetLine({ subcategory: "Sale Price", category: "Selling Price", estimated: D(700000), actual: D(680000) })];

    const result = computeProperty(budget, costExpenses, []);
    expect(result.sold).toBe(true);
    expect(result.priceBasis.toNumber()).toBe(680000);
    expect(result.actProfit.toNumber()).toBe(680000 - 518000);
  });

  it("regression: an unsold property must not show a false loss from mixing bases", () => {
    // A wrong implementation might compare actual cost against $0 (no actual price yet),
    // which would show every unsold property as a catastrophic loss. Guard against that.
    const budget = [
      budgetLine({ subcategory: "Purchase Price", category: "Purchase Costs", estimated: D(985000) }),
      budgetLine({ subcategory: "Sale Price", category: "Selling Price", estimated: D(1520000), actual: D(0) }),
    ];
    const expenses: ExpenseInput[] = [{ subcategory: "Purchase Price", amount: D(985000) }];

    const result = computeProperty(budget, expenses, []);
    expect(result.actProfit.toNumber()).not.toBe(0 - 985000);
    expect(result.priceBasis.toNumber()).toBe(1520000);
  });

  it("computes margin as profit / basis × 100", () => {
    const budget = [
      budgetLine({ subcategory: "Purchase Price", category: "Purchase Costs", estimated: D(100000) }),
      budgetLine({ subcategory: "Sale Price", category: "Selling Price", estimated: D(150000), actual: D(150000) }),
    ];
    const expenses: ExpenseInput[] = [{ subcategory: "Purchase Price", amount: D(100000) }];

    const result = computeProperty(budget, expenses, []);
    // profit = 50000, basis = 150000 -> margin = 33.33...%
    expect(result.actMargin).toBeCloseTo((50000 / 150000) * 100, 5);
  });
});
