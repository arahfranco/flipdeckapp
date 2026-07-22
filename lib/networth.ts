import { Prisma, Status, ContribKind } from "@prisma/client";
import { computeProperty, type BudgetLineInput, type ExpenseInput, type PayrollInput } from "./calc";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// Company balance sheet. Money is Decimal end-to-end, never JS floats —
// same discipline as lib/calc.ts.

export interface PropertyInput {
  id: string;
  address: string;
  status: Status;
  /** current ARV/appraisal; null falls back to the budget's estimated Sale Price */
  marketValue: Decimal | null;
  monthlyRent: Decimal | null;
  budget: BudgetLineInput[];
  expenses: ExpenseInput[];
  payroll: PayrollInput[];
}

export interface LiabilityInput {
  id: string;
  name: string;
  balance: Decimal;
  propertyId: string | null;
}

export interface CashAccountInput {
  id: string;
  name: string;
  balance: Decimal;
}

export interface ContributionInput {
  partnerId: string;
  kind: ContribKind;
  amount: Decimal;
}

export interface PropertyValuation {
  id: string;
  address: string;
  status: Status;
  /** marketValue when set, else the budget's estimated Sale Price */
  value: Decimal;
  /** true when `value` fell back to the estimate — surfaced in the UI */
  valueIsEstimated: boolean;
  costBasis: Decimal;
  unrealizedGain: Decimal;
}

export interface NetWorth {
  properties: PropertyValuation[];
  propertyValue: Decimal;
  cash: Decimal;
  totalAssets: Decimal;
  outsideDebt: Decimal;
  partnerLoans: Decimal;
  totalLiabilities: Decimal;
  companyEquity: Decimal;
  partnerEquity: Decimal;
  monthlyRent: Decimal;
  annualRent: Decimal;
}

/**
 * A SOLD property is no longer an asset — the proceeds have become cash, so
 * counting both would double-count the same money. Held properties (any
 * status except SOLD) are what make up property value.
 */
const isHeld = (status: Status) => status !== Status.SOLD;

export function computeNetWorth(
  properties: PropertyInput[],
  liabilities: LiabilityInput[],
  cashAccounts: CashAccountInput[],
  contributions: ContributionInput[]
): NetWorth {
  const held = properties.filter((p) => isHeld(p.status));

  const valuations: PropertyValuation[] = held.map((p) => {
    const rollup = computeProperty(p.budget, p.expenses, p.payroll);
    const value = p.marketValue ?? rollup.estPrice;
    return {
      id: p.id,
      address: p.address,
      status: p.status,
      value,
      valueIsEstimated: p.marketValue == null,
      costBasis: rollup.totalActCost,
      unrealizedGain: value.minus(rollup.totalActCost),
    };
  });

  const propertyValue = valuations.reduce((s, v) => s.plus(v.value), new Decimal(0));
  const cash = cashAccounts.reduce((s, a) => s.plus(a.balance), new Decimal(0));
  const totalAssets = propertyValue.plus(cash);

  const outsideDebt = liabilities.reduce((s, l) => s.plus(l.balance), new Decimal(0));
  // Partner LOAN capital is genuinely money the company owes, so it belongs
  // in liabilities — reported separately from third-party debt so the
  // distinction stays visible. EQUITY/DRAW are owner capital, not debt.
  const partnerLoans = contributions
    .filter((c) => c.kind === ContribKind.LOAN)
    .reduce((s, c) => s.plus(c.amount), new Decimal(0));
  const totalLiabilities = outsideDebt.plus(partnerLoans);

  // Owner capital actually put in and left in: EQUITY − DRAW (spec §3).
  const partnerEquity = contributions.reduce((s, c) => {
    if (c.kind === ContribKind.EQUITY) return s.plus(c.amount);
    if (c.kind === ContribKind.DRAW) return s.minus(c.amount);
    return s;
  }, new Decimal(0));

  const monthlyRent = held.reduce((s, p) => s.plus(p.monthlyRent ?? new Decimal(0)), new Decimal(0));

  return {
    properties: valuations,
    propertyValue,
    cash,
    totalAssets,
    outsideDebt,
    partnerLoans,
    totalLiabilities,
    companyEquity: totalAssets.minus(totalLiabilities),
    partnerEquity,
    monthlyRent,
    annualRent: monthlyRent.times(12),
  };
}
