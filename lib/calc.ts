import { Prisma } from "@prisma/client";
import { CATEGORIES, COST_CATEGORIES, LABOR_SUBCATEGORY, SUBS_BY_CAT, type Category } from "./constants";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// This is the rollup chain — the heart of the app. Ported line-for-line from
// computeProperty() in the prototype (FlipDeck (1).jsx:266-317), which is the
// tested spec for these rules. Do not "simplify" the precedence below:
// an expense-log sum for a subcategory OVERRIDES the budget line's stored
// actual; it is never added to it (that double-counts).

export interface BudgetLineInput {
  id: string;
  category: string;
  subcategory: string;
  estimated: Decimal;
  actual: Decimal;
}

export interface ExpenseInput {
  subcategory: string;
  amount: Decimal;
}

export interface PayrollInput {
  hours: Decimal;
  rate: Decimal;
}

export interface RolledLine {
  id: string;
  category: Category;
  subcategory: string;
  estimated: Decimal;
  actual: Decimal;
  derived?: boolean;
  /** true when `actual` came from the expense log, overriding the stored budget-line actual */
  overridden?: boolean;
}

export interface CategoryRollup {
  estimated: Decimal;
  actual: Decimal;
  rows: RolledLine[];
}

export interface PropertyComputation {
  byCat: Record<Category, CategoryRollup>;
  totalEstCost: Decimal;
  totalActCost: Decimal;
  estPrice: Decimal;
  actPrice: Decimal;
  /** actual sale price if sold, else estimated sale price — see §2 of the spec */
  priceBasis: Decimal;
  estProfit: Decimal;
  actProfit: Decimal;
  estMargin: number;
  actMargin: number;
  sold: boolean;
}

export function computeProperty(
  budget: BudgetLineInput[],
  expenses: ExpenseInput[],
  payroll: PayrollInput[]
): PropertyComputation {
  // Expenses Log rolls into rehab actuals; payroll rolls into a synthetic Labor line.
  const expActual = new Map<string, Decimal>();
  for (const e of expenses) {
    expActual.set(e.subcategory, (expActual.get(e.subcategory) ?? new Decimal(0)).plus(e.amount));
  }
  const laborActual = payroll.reduce((sum, p) => sum.plus(p.hours.times(p.rate)), new Decimal(0));

  // "Purchase Costs" (Purchase Price, Closing Costs, Title & Escrow, Inspection,
  // Appraisal, Transfer Tax) and "Selling Price" (Sale Price) are both
  // one-time, entered-once figures — a closing/escrow transaction, not
  // something tracked line-by-line through the expenses log the way ongoing
  // rehab spending is. Their stored `actual` is meaningful and kept.
  // Every other cost category is purely expense-derived — $0 until a real
  // expense exists, never falling back to a stored value (which can go
  // stale, e.g. after a property is repurposed and its old actuals no
  // longer apply).
  const DIRECT_ENTRY_CATEGORIES: Category[] = ["Purchase Costs", "Selling Price"];

  const rows: RolledLine[] = budget.map((l) => {
    const override = expActual.get(l.subcategory);
    const actual =
      override != null ? override : DIRECT_ENTRY_CATEGORIES.includes(l.category as Category) ? l.actual : new Decimal(0);
    return {
      id: l.id,
      category: l.category as Category,
      subcategory: l.subcategory,
      actual,
      estimated: l.estimated,
      overridden: override != null,
    };
  });

  if (laborActual.greaterThan(0)) {
    rows.push({
      id: `labor-synthetic`,
      category: "Rehab Costs",
      subcategory: LABOR_SUBCATEGORY,
      estimated: new Decimal(0),
      actual: laborActual,
      derived: true,
    });
  }

  const byCat = {} as Record<Category, CategoryRollup>;
  for (const c of CATEGORIES) {
    byCat[c] = { estimated: new Decimal(0), actual: new Decimal(0), rows: [] };
  }
  for (const r of rows) {
    byCat[r.category].estimated = byCat[r.category].estimated.plus(r.estimated);
    byCat[r.category].actual = byCat[r.category].actual.plus(r.actual);
    byCat[r.category].rows.push(r);
  }

  // Postgres has no stable row order without an explicit ORDER BY, so without
  // this a row can visibly jump position after an unrelated edit. Sort each
  // category's rows to match the canonical subcategory order (spec §3);
  // Labor (Payroll) is derived and not in SUBS_BY_CAT, so it sorts last.
  for (const c of CATEGORIES) {
    const order = SUBS_BY_CAT[c];
    const rank = (sub: string) => {
      const i = order.indexOf(sub);
      return i === -1 ? order.length : i; // not-in-list (e.g. Labor) sorts last
    };
    byCat[c].rows.sort((a, b) => rank(a.subcategory) - rank(b.subcategory));
  }

  const totalEstCost = COST_CATEGORIES.reduce((s, c) => s.plus(byCat[c].estimated), new Decimal(0));
  const totalActCost = COST_CATEGORIES.reduce((s, c) => s.plus(byCat[c].actual), new Decimal(0));
  const estPrice = byCat["Selling Price"].estimated;
  const actPrice = byCat["Selling Price"].actual;

  const estProfit = estPrice.minus(totalEstCost);
  // Until the property sells, "actual" profit is measured against the estimated
  // sale price. After it sells, against the real one. Getting this backwards makes
  // every unsold property show a catastrophic loss (spec §2).
  const priceBasis = actPrice.greaterThan(0) ? actPrice : estPrice;
  const actProfit = priceBasis.minus(totalActCost);

  return {
    byCat,
    totalEstCost,
    totalActCost,
    estPrice,
    actPrice,
    priceBasis,
    estProfit,
    actProfit,
    estMargin: estPrice.isZero() ? 0 : estProfit.dividedBy(estPrice).times(100).toNumber(),
    actMargin: priceBasis.isZero() ? 0 : actProfit.dividedBy(priceBasis).times(100).toNumber(),
    sold: actPrice.greaterThan(0),
  };
}
