import { Role, Status, ExpenseStatus, LiabilityKind, IncomeCategory } from "@prisma/client";

// The five budget categories and their subcategories (spec §3 "The five categories").
// "Selling Price" is revenue, not cost — computeProperty() in calc.ts treats it separately.
export const CATEGORIES = [
  "Purchase Costs",
  "Rehab Costs",
  "Holding Costs",
  "Selling Costs",
  "Selling Price",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const COST_CATEGORIES: Category[] = ["Purchase Costs", "Rehab Costs", "Holding Costs", "Selling Costs"];

export const SUBS_BY_CAT: Record<Category, string[]> = {
  "Purchase Costs": ["Purchase Price", "Closing Costs", "Title & Escrow", "Inspection", "Appraisal", "Transfer Tax"],
  "Rehab Costs": [
    "Demolition", "Foundation", "Framing", "Roofing", "Siding", "Windows", "Exterior Doors", "Gutters",
    "Electrical", "Plumbing", "HVAC", "Insulation", "Drywall", "Interior Doors", "Trim & Millwork",
    "Interior Paint", "Exterior Paint", "Flooring", "Tile", "Kitchen Cabinets", "Countertops", "Appliances",
    "Bathroom Fixtures", "Lighting", "Hardware", "Landscaping", "Fencing", "Driveway & Concrete",
    "Permits & Inspections", "Dumpster & Cleanup", "Contingency",
    // "Labor (Payroll)" is derived from PayrollEntry sums, not user-editable — see calc.ts.
  ],
  "Holding Costs": ["Loan Interest", "Property Tax", "Insurance", "Utilities", "HOA Dues", "Security & Maintenance"],
  "Selling Costs": ["Listing Commission", "Buyer Commission", "Staging", "Photography", "Escrow Fees", "Seller Concessions"],
  "Selling Price": ["Sale Price"],
};

export const LABOR_SUBCATEGORY = "Labor (Payroll)";

export type Section = "portfolio" | "properties" | "expenses" | "bank" | "payroll" | "partners" | "account";

export const ALL_SUBS: { cat: Category; sub: string }[] = Object.entries(SUBS_BY_CAT).flatMap(([cat, subs]) =>
  subs.map((sub) => ({ cat: cat as Category, sub }))
);

export function categoryOf(subcategory: string): Category {
  return ALL_SUBS.find((x) => x.sub === subcategory)?.cat ?? "Rehab Costs";
}

// Role -> visible sections. This is UI convenience for hiding nav items ONLY.
// It is NOT the authorization boundary — every API route must independently
// check role server-side (spec §4). See lib/authz.ts.
export const CAN_SEE: Record<Role, string[]> = {
  [Role.OWNER]: ["portfolio", "properties", "expenses", "bank", "payroll", "partners", "account"],
  [Role.PARTNER]: ["portfolio", "properties", "expenses", "partners", "account"],
  [Role.PARTNER_LENDER]: ["portfolio", "properties", "partners", "account"],
  [Role.BOOKKEEPER]: ["portfolio", "properties", "expenses", "bank", "payroll", "account"],
};

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  [IncomeCategory.RENT]: "Rent",
  [IncomeCategory.SALE_PROCEEDS]: "Sale Proceeds",
  [IncomeCategory.REFUND]: "Refund",
  [IncomeCategory.OTHER]: "Other",
};

export const LIABILITY_KIND_LABELS: Record<LiabilityKind, string> = {
  [LiabilityKind.MORTGAGE]: "Mortgage",
  [LiabilityKind.HARD_MONEY]: "Hard Money",
  [LiabilityKind.LINE_OF_CREDIT]: "Line of Credit",
  [LiabilityKind.CREDIT_CARD]: "Credit Card",
  [LiabilityKind.OTHER]: "Other",
};

export const ROLE_LABELS: Record<Role, string> = {
  [Role.OWNER]: "Owner",
  [Role.PARTNER]: "Partner",
  [Role.PARTNER_LENDER]: "Partner (Lender)",
  [Role.BOOKKEEPER]: "Bookkeeper",
};

// Maps to the prototype's pill CSS classes (.s-scout, .s-rehab, ...) — the enum
// values don't textually match those suffixes (e.g. IN_REHAB vs "rehab").
export const STATUS_TONE: Record<Status, string> = {
  [Status.SCOUTING]: "s-scout",
  [Status.UNDER_CONTRACT]: "s-contract",
  [Status.IN_REHAB]: "s-rehab",
  [Status.LISTED]: "s-listed",
  [Status.IN_ESCROW]: "s-escrow",
  [Status.SOLD]: "s-sold",
};

export const STATUS_LABELS: Record<Status, string> = {
  [Status.SCOUTING]: "Scouting",
  [Status.UNDER_CONTRACT]: "Under Contract",
  [Status.IN_REHAB]: "In Rehab",
  [Status.LISTED]: "Listed",
  [Status.IN_ESCROW]: "In Escrow",
  [Status.SOLD]: "Sold",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  [ExpenseStatus.PENDING]: "Pending",
  [ExpenseStatus.PAID]: "Paid",
  [ExpenseStatus.REIMBURSED]: "Reimbursed",
};
