import { describe, expect, it } from "vitest";
import { Prisma, Status, ContribKind } from "@prisma/client";
import {
  computeNetWorth,
  type PropertyInput,
  type LiabilityInput,
  type CashAccountInput,
  type ContributionInput,
} from "../networth";
import type { BudgetLineInput } from "../calc";

const D = (n: number) => new Prisma.Decimal(n);

function budgetLine(subcategory: string, category: string, estimated: number): BudgetLineInput {
  return { id: subcategory, category, subcategory, estimated: D(estimated), actual: D(0) };
}

/** A property with a $500k purchase cost logged as a real expense and a $700k sale estimate. */
function property(overrides: Partial<PropertyInput> = {}): PropertyInput {
  return {
    id: "p1",
    address: "1 Test St",
    status: Status.IN_REHAB,
    marketValue: null,
    monthlyRent: null,
    budget: [
      budgetLine("Purchase Price", "Purchase Costs", 500000),
      budgetLine("Sale Price", "Selling Price", 700000),
    ],
    expenses: [{ subcategory: "Purchase Price", amount: D(500000) }],
    payroll: [],
    ...overrides,
  };
}

describe("computeNetWorth — property valuation", () => {
  it("uses marketValue when set, overriding the estimated sale price", () => {
    const result = computeNetWorth([property({ marketValue: D(640000) })], [], [], []);
    expect(result.propertyValue.toNumber()).toBe(640000);
    expect(result.properties[0].valueIsEstimated).toBe(false);
  });

  it("falls back to the estimated Sale Price when marketValue is blank", () => {
    const result = computeNetWorth([property({ marketValue: null })], [], [], []);
    expect(result.propertyValue.toNumber()).toBe(700000);
    expect(result.properties[0].valueIsEstimated).toBe(true);
  });

  it("excludes SOLD properties from assets — proceeds are already counted as cash", () => {
    const result = computeNetWorth(
      [property({ id: "held" }), property({ id: "sold", status: Status.SOLD, marketValue: D(999999) })],
      [],
      [],
      []
    );
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].id).toBe("held");
    expect(result.propertyValue.toNumber()).toBe(700000);
  });

  it("computes unrealized gain against actual cost basis, not the estimate", () => {
    const result = computeNetWorth([property({ marketValue: D(640000) })], [], [], []);
    // cost basis = the $500k logged expense; gain = 640k − 500k
    expect(result.properties[0].costBasis.toNumber()).toBe(500000);
    expect(result.properties[0].unrealizedGain.toNumber()).toBe(140000);
  });
});

describe("computeNetWorth — liabilities", () => {
  const liabilities: LiabilityInput[] = [
    { id: "l1", name: "Anchor Capital", balance: D(300000), propertyId: "p1" },
    { id: "l2", name: "Company LOC", balance: D(25000), propertyId: null },
  ];

  it("sums outside debt", () => {
    const result = computeNetWorth([], liabilities, [], []);
    expect(result.outsideDebt.toNumber()).toBe(325000);
  });

  it("counts partner LOAN capital as a liability, but not EQUITY or DRAW", () => {
    const contributions: ContributionInput[] = [
      { partnerId: "a1", kind: ContribKind.LOAN, amount: D(250000) },
      { partnerId: "a2", kind: ContribKind.EQUITY, amount: D(180000) },
      { partnerId: "a2", kind: ContribKind.DRAW, amount: D(40000) },
    ];
    const result = computeNetWorth([], [], [], contributions);
    expect(result.partnerLoans.toNumber()).toBe(250000);
    // EQUITY − DRAW, with the loan excluded from owner capital
    expect(result.partnerEquity.toNumber()).toBe(140000);
  });

  it("totals outside debt plus partner loans", () => {
    const contributions: ContributionInput[] = [{ partnerId: "a1", kind: ContribKind.LOAN, amount: D(250000) }];
    const result = computeNetWorth([], liabilities, [], contributions);
    expect(result.totalLiabilities.toNumber()).toBe(575000);
  });
});

describe("computeNetWorth — equity and totals", () => {
  it("company equity equals total assets minus total liabilities", () => {
    const cash: CashAccountInput[] = [
      { id: "c1", name: "Operating", balance: D(50000) },
      { id: "c2", name: "Reserve", balance: D(20000) },
    ];
    const liabilities: LiabilityInput[] = [{ id: "l1", name: "Anchor", balance: D(300000), propertyId: "p1" }];
    const contributions: ContributionInput[] = [{ partnerId: "a1", kind: ContribKind.LOAN, amount: D(100000) }];

    const result = computeNetWorth([property({ marketValue: D(640000) })], liabilities, cash, contributions);

    expect(result.cash.toNumber()).toBe(70000);
    expect(result.totalAssets.toNumber()).toBe(710000); // 640k property + 70k cash
    expect(result.totalLiabilities.toNumber()).toBe(400000); // 300k outside + 100k partner loan
    expect(result.companyEquity.toNumber()).toBe(310000);
    expect(result.companyEquity.toNumber()).toBe(
      result.totalAssets.minus(result.totalLiabilities).toNumber()
    );
  });

  it("reports negative equity when debt exceeds assets rather than clamping at zero", () => {
    const liabilities: LiabilityInput[] = [{ id: "l1", name: "Anchor", balance: D(900000), propertyId: null }];
    const result = computeNetWorth([property({ marketValue: D(640000) })], liabilities, [], []);
    expect(result.companyEquity.toNumber()).toBe(-260000);
  });

  it("is all zeros with no data at all", () => {
    const result = computeNetWorth([], [], [], []);
    expect(result.totalAssets.toNumber()).toBe(0);
    expect(result.totalLiabilities.toNumber()).toBe(0);
    expect(result.companyEquity.toNumber()).toBe(0);
  });
});

describe("computeNetWorth — rental income", () => {
  it("sums monthly rent across held properties and annualizes it", () => {
    const result = computeNetWorth(
      [
        property({ id: "a", monthlyRent: D(2200) }),
        property({ id: "b", monthlyRent: D(1800) }),
        property({ id: "c", monthlyRent: null }),
      ],
      [],
      [],
      []
    );
    expect(result.monthlyRent.toNumber()).toBe(4000);
    expect(result.annualRent.toNumber()).toBe(48000);
  });

  it("ignores rent on a SOLD property", () => {
    const result = computeNetWorth(
      [property({ id: "sold", status: Status.SOLD, monthlyRent: D(5000) })],
      [],
      [],
      []
    );
    expect(result.monthlyRent.toNumber()).toBe(0);
  });
});
