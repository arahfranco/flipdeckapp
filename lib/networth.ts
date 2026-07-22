import { Prisma, Status, ContribKind, TxnDirection } from "@prisma/client";
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

export interface BankAccountInput {
  id: string;
  name: string;
  /** 0 when starting from zero and importing full history */
  openingBalance: Decimal;
  transactions: { amount: Decimal; direction: TxnDirection }[];
}

export interface BankAccountBalance {
  id: string;
  name: string;
  openingBalance: Decimal;
  moneyIn: Decimal;
  moneyOut: Decimal;
  /** openingBalance + in − out; derived, never stored */
  balance: Decimal;
}

/**
 * Derived so the balance can't drift from the transactions behind it. With
 * openingBalance 0 this is only right once the full history is imported —
 * that's the deliberate trade-off of starting from zero.
 */
export function accountBalance(account: BankAccountInput): BankAccountBalance {
  const moneyIn = account.transactions
    .filter((t) => t.direction === TxnDirection.IN)
    .reduce((s, t) => s.plus(t.amount), new Decimal(0));
  const moneyOut = account.transactions
    .filter((t) => t.direction === TxnDirection.OUT)
    .reduce((s, t) => s.plus(t.amount), new Decimal(0));
  return {
    id: account.id,
    name: account.name,
    openingBalance: account.openingBalance,
    moneyIn,
    moneyOut,
    balance: account.openingBalance.plus(moneyIn).minus(moneyOut),
  };
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
  /** Whatever is stored on the property; only counts toward rental income when RENTED. */
  monthlyRent: Decimal | null;
}

export interface NetWorth {
  properties: PropertyValuation[];
  propertyValue: Decimal;
  accounts: BankAccountBalance[];
  cash: Decimal;
  totalAssets: Decimal;
  outsideDebt: Decimal;
  partnerLoans: Decimal;
  totalLiabilities: Decimal;
  companyEquity: Decimal;
  partnerEquity: Decimal;
  /** rent actually being collected — RENTED properties only, not projections */
  monthlyRent: Decimal;
  annualRent: Decimal;
  rentedCount: number;
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
  bankAccounts: BankAccountInput[],
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
      monthlyRent: p.monthlyRent,
    };
  });

  const propertyValue = valuations.reduce((s, v) => s.plus(v.value), new Decimal(0));
  const accounts = bankAccounts.map(accountBalance);
  const cash = accounts.reduce((s, a) => s.plus(a.balance), new Decimal(0));
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

  // Only RENTED properties, so this is rent actually being collected. Rent set
  // on a property still in rehab is a projection of what it could earn once
  // finished — counting it here would report money that isn't coming in.
  const rented = properties.filter((p) => p.status === Status.RENTED);
  const monthlyRent = rented.reduce((s, p) => s.plus(p.monthlyRent ?? new Decimal(0)), new Decimal(0));

  return {
    properties: valuations,
    propertyValue,
    accounts,
    cash,
    totalAssets,
    outsideDebt,
    partnerLoans,
    totalLiabilities,
    companyEquity: totalAssets.minus(totalLiabilities),
    partnerEquity,
    monthlyRent,
    annualRent: monthlyRent.times(12),
    rentedCount: rented.length,
  };
}
