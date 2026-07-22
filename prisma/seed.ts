import { PrismaClient, Role, Status, ExpenseStatus, ContribKind, TxnDirection } from "@prisma/client";
import { importHash } from "../lib/csvImport";

const prisma = new PrismaClient();

// Ported from the prototype's seed data (FlipDeck (1).jsx) so the dashboards are
// legible immediately — three Bay Area properties, one sold.

const CATEGORIES = ["Purchase Costs", "Rehab Costs", "Holding Costs", "Selling Costs", "Selling Price"] as const;

const SUBS_BY_CAT: Record<string, string[]> = {
  "Purchase Costs": ["Purchase Price", "Closing Costs", "Title & Escrow", "Inspection", "Appraisal", "Transfer Tax"],
  "Rehab Costs": [
    "Demolition", "Foundation", "Framing", "Roofing", "Siding", "Windows", "Exterior Doors", "Gutters",
    "Electrical", "Plumbing", "HVAC", "Insulation", "Drywall", "Interior Doors", "Trim & Millwork",
    "Interior Paint", "Exterior Paint", "Flooring", "Tile", "Kitchen Cabinets", "Countertops", "Appliances",
    "Bathroom Fixtures", "Lighting", "Hardware", "Landscaping", "Fencing", "Driveway & Concrete",
    "Permits & Inspections", "Dumpster & Cleanup", "Contingency", "Labor (Payroll)",
  ],
  "Holding Costs": ["Loan Interest", "Property Tax", "Insurance", "Utilities", "HOA Dues", "Security & Maintenance"],
  "Selling Costs": ["Listing Commission", "Buyer Commission", "Staging", "Photography", "Escrow Fees", "Seller Concessions"],
  "Selling Price": ["Sale Price"],
};

const ALL_SUBS = Object.entries(SUBS_BY_CAT).flatMap(([cat, subs]) => subs.map((s) => ({ cat, sub: s })));
const catOf = (sub: string) => ALL_SUBS.find((x) => x.sub === sub)?.cat ?? "Rehab Costs";

const line = (propertyId: string, sub: string, estimated: number, actual = 0) => ({
  propertyId,
  category: catOf(sub),
  subcategory: sub,
  estimated,
  actual,
});

async function main() {
  const company = {
    id: "company1",
    name: "Foundational Real Estate",
    appName: "Flipdeck",
    tagline: "Fix & Flip Ledger",
  };
  await prisma.company.upsert({ where: { id: company.id }, update: company, create: company });

  const partners = [
    { id: "a1", name: "A. Villareal" },
    { id: "a2", name: "R. Okafor" },
    { id: "a3", name: "J. Lindqvist" },
  ];
  for (const p of partners) {
    await prisma.partner.upsert({ where: { id: p.id }, update: p, create: p });
  }

  const users = [
    { id: "u1", name: "A. Villareal", role: Role.OWNER, email: "a@foundationalrealestate.co", phone: "(415) 555-0134", partnerId: "a1" },
    { id: "u2", name: "R. Okafor", role: Role.PARTNER, email: "r@foundationalrealestate.co", phone: "(415) 555-0198", partnerId: "a2" },
    { id: "u3", name: "J. Lindqvist", role: Role.PARTNER_LENDER, email: "j@foundationalrealestate.co", phone: "(650) 555-0177", partnerId: "a3" },
    { id: "u4", name: "M. Santos", role: Role.BOOKKEEPER, email: "m@foundationalrealestate.co", phone: "(408) 555-0142", partnerId: null },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { id: u.id }, update: u, create: u });
  }

  const properties = [
    {
      id: "p1", address: "5231 Silver Reef Dr, Fremont, CA 94538", mls: "ML81974302",
      type: "Single Family", beds: 4, baths: 2.5, sqft: 2140, lotSize: 6500, stories: 2,
      status: Status.IN_REHAB,
      photoUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&q=70",
    },
    {
      id: "p2", address: "134 Claremont Ave, South San Francisco, CA 94080", mls: "ML81968115",
      type: "Single Family", beds: 3, baths: 2, sqft: 1480, lotSize: 4100, stories: 1,
      status: Status.LISTED,
      photoUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900&q=70",
    },
    {
      id: "p3", address: "2870 Thousand Oaks Dr, San Jose, CA 95132", mls: "ML81955540",
      type: "Single Family", beds: 4, baths: 3, sqft: 2380, lotSize: 7200, stories: 2,
      status: Status.SOLD,
      photoUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=70",
    },
  ];
  for (const p of properties) {
    await prisma.property.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  const budget = [
    // ---- p1 Fremont
    line("p1", "Purchase Price", 985000, 985000),
    line("p1", "Closing Costs", 14000, 13120),
    line("p1", "Title & Escrow", 6500, 6820),
    line("p1", "Inspection", 1200, 1450),
    line("p1", "Demolition", 12000, 13800),
    line("p1", "Framing", 18000, 21400),
    line("p1", "Roofing", 26000, 24900),
    line("p1", "Electrical", 22000, 26750),
    line("p1", "Plumbing", 19000, 18200),
    line("p1", "HVAC", 16500, 0),
    line("p1", "Drywall", 14000, 11600),
    line("p1", "Interior Paint", 9500, 8900),
    line("p1", "Flooring", 21000, 0),
    line("p1", "Kitchen Cabinets", 24000, 0),
    line("p1", "Countertops", 11000, 0),
    line("p1", "Bathroom Fixtures", 9000, 4200),
    line("p1", "Landscaping", 8000, 0),
    line("p1", "Permits & Inspections", 6500, 7150),
    line("p1", "Dumpster & Cleanup", 4000, 3100),
    line("p1", "Contingency", 25000, 0),
    line("p1", "Loan Interest", 42000, 21400),
    line("p1", "Property Tax", 11000, 5700),
    line("p1", "Insurance", 4200, 2100),
    line("p1", "Utilities", 2800, 1640),
    line("p1", "Listing Commission", 38000, 0),
    line("p1", "Buyer Commission", 38000, 0),
    line("p1", "Staging", 9000, 0),
    line("p1", "Escrow Fees", 5000, 0),
    line("p1", "Sale Price", 1520000, 0),

    // ---- p2 South SF
    line("p2", "Purchase Price", 720000, 720000),
    line("p2", "Closing Costs", 11000, 10400),
    line("p2", "Title & Escrow", 5200, 5200),
    line("p2", "Roofing", 18000, 17250),
    line("p2", "Electrical", 15000, 16400),
    line("p2", "Plumbing", 12000, 12900),
    line("p2", "Drywall", 9000, 8700),
    line("p2", "Interior Paint", 7000, 7250),
    line("p2", "Flooring", 15000, 16100),
    line("p2", "Kitchen Cabinets", 19000, 20400),
    line("p2", "Countertops", 8500, 8900),
    line("p2", "Appliances", 7000, 6850),
    line("p2", "Bathroom Fixtures", 6500, 6300),
    line("p2", "Lighting", 4000, 4450),
    line("p2", "Landscaping", 6000, 5800),
    line("p2", "Permits & Inspections", 4500, 5100),
    line("p2", "Contingency", 15000, 0),
    line("p2", "Loan Interest", 28000, 26900),
    line("p2", "Property Tax", 7500, 7200),
    line("p2", "Insurance", 3200, 3200),
    line("p2", "Listing Commission", 26000, 0),
    line("p2", "Buyer Commission", 26000, 0),
    line("p2", "Staging", 7500, 7500),
    line("p2", "Escrow Fees", 3800, 0),
    line("p2", "Sale Price", 1075000, 0),

    // ---- p3 San Jose (sold)
    line("p3", "Purchase Price", 890000, 890000),
    line("p3", "Closing Costs", 13000, 12750),
    line("p3", "Title & Escrow", 6000, 6000),
    line("p3", "Framing", 14000, 15900),
    line("p3", "Roofing", 22000, 22400),
    line("p3", "Electrical", 19000, 20100),
    line("p3", "Plumbing", 17000, 17800),
    line("p3", "HVAC", 14000, 13600),
    line("p3", "Drywall", 12000, 12300),
    line("p3", "Interior Paint", 8500, 8200),
    line("p3", "Flooring", 19000, 20500),
    line("p3", "Kitchen Cabinets", 22000, 23800),
    line("p3", "Countertops", 10000, 10600),
    line("p3", "Appliances", 9000, 9400),
    line("p3", "Bathroom Fixtures", 8000, 8150),
    line("p3", "Landscaping", 7500, 8900),
    line("p3", "Permits & Inspections", 5500, 6200),
    line("p3", "Contingency", 20000, 0),
    line("p3", "Loan Interest", 36000, 39200),
    line("p3", "Property Tax", 9500, 10100),
    line("p3", "Insurance", 3800, 3800),
    line("p3", "Listing Commission", 33000, 33900),
    line("p3", "Buyer Commission", 33000, 33900),
    line("p3", "Staging", 8500, 8500),
    line("p3", "Escrow Fees", 4500, 4720),
    line("p3", "Sale Price", 1350000, 1356000),
  ];
  for (const b of budget) {
    await prisma.budgetLine.upsert({
      where: { propertyId_subcategory: { propertyId: b.propertyId, subcategory: b.subcategory } },
      update: {},
      create: b,
    });
  }

  // Expense/BankTxn/PayrollEntry/Contribution have no natural unique key in the
  // seed data, so clear them before re-inserting to keep `npm run db:seed` idempotent.
  await prisma.expense.deleteMany({});
  await prisma.income.deleteMany({});
  await prisma.bankTxn.deleteMany({});
  await prisma.bankAccount.deleteMany({});
  await prisma.payrollEntry.deleteMany({});
  await prisma.contribution.deleteMany({});

  const expenses = [
    { date: "2026-06-02", propertyId: "p1", amount: 13800, description: "Interior demo, full gut of kitchen + 2 baths", subcategory: "Demolition", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/9f2a" },
    { date: "2026-06-11", propertyId: "p1", amount: 21400, description: "Structural framing, load-bearing wall removal", subcategory: "Framing", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/1c88" },
    { date: "2026-06-18", propertyId: "p1", amount: 24900, description: "Comp shingle tear-off and replace", subcategory: "Roofing", status: ExpenseStatus.PAID, receiptUrl: null },
    { date: "2026-06-25", propertyId: "p1", amount: 26750, description: "Full rewire, new 200A panel", subcategory: "Electrical", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/44b1" },
    { date: "2026-07-01", propertyId: "p1", amount: 18200, description: "Repipe, PEX throughout", subcategory: "Plumbing", status: ExpenseStatus.PENDING, receiptUrl: null },
    { date: "2026-07-06", propertyId: "p1", amount: 11600, description: "Hang + tape, level 4 finish", subcategory: "Drywall", status: ExpenseStatus.PENDING, receiptUrl: null },
    { date: "2026-07-08", propertyId: "p1", amount: 4200, description: "Vanities and tub deposit", subcategory: "Bathroom Fixtures", status: ExpenseStatus.PENDING, receiptUrl: null },
    { date: "2026-05-14", propertyId: "p2", amount: 20400, description: "Shaker cabinets, full kitchen", subcategory: "Kitchen Cabinets", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/7d3e" },
    { date: "2026-05-22", propertyId: "p2", amount: 16100, description: "Engineered oak, 1,480 sqft", subcategory: "Flooring", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/2ab0" },
    { date: "2026-06-04", propertyId: "p2", amount: 8900, description: "Quartz slab, install + template", subcategory: "Countertops", status: ExpenseStatus.PAID, receiptUrl: null },
  ];
  for (const e of expenses) {
    await prisma.expense.create({ data: { ...e, date: new Date(e.date) } });
  }

  // Opening balance is the cash that existed before the first imported row —
  // the derived balance is this plus money in, minus money out.
  const chase = await prisma.bankAccount.create({
    data: { name: "Chase •4471", openingBalance: 250000 },
  });

  const bank = [
    { date: "2026-07-10", description: "DEPOSIT — PARTNER WIRE", amount: 75000.0, direction: TxnDirection.IN, propertyId: null, subcategory: null, reconciled: false },
    { date: "2026-07-09", description: "HOME DEPOT #6832 FREMONT CA", amount: 3184.22, direction: TxnDirection.OUT, propertyId: null, subcategory: null, reconciled: false },
    { date: "2026-07-08", description: "SIERRA ROOFING SUPPLY", amount: 6420.0, direction: TxnDirection.OUT, propertyId: null, subcategory: null, reconciled: false },
    { date: "2026-07-07", description: "ACH DEBIT — PG&E UTILITY", amount: 412.88, direction: TxnDirection.OUT, propertyId: null, subcategory: null, reconciled: false },
    { date: "2026-07-06", description: "CHECK 1042 — M. TORRES", amount: 2880.0, direction: TxnDirection.OUT, propertyId: null, subcategory: null, reconciled: false },
    { date: "2026-07-02", description: "WIRE OUT — FIRST AMERICAN TITLE", amount: 6820.0, direction: TxnDirection.OUT, propertyId: "p1", subcategory: "Title & Escrow", reconciled: true },
    { date: "2026-06-28", description: "BAY AREA ELECTRIC LLC", amount: 26750.0, direction: TxnDirection.OUT, propertyId: "p1", subcategory: "Electrical", reconciled: true },
  ];
  for (const b of bank) {
    await prisma.bankTxn.create({
      data: {
        ...b,
        date: new Date(b.date),
        accountId: chase.id,
        importHash: importHash(chase.id, b.date, b.amount, b.direction, b.description),
      },
    });
  }

  const workerNames = ["Miguel Torres", "Danny Reyes", "Sam Oduya", "Lena Ruiz"];
  const workerIds: Record<string, string> = {};
  for (const name of workerNames) {
    const w = await prisma.worker.upsert({ where: { name }, update: {}, create: { name } });
    workerIds[name] = w.id;
  }

  const payroll = [
    { date: "2026-07-05", propertyId: "p1", worker: "Miguel Torres", hours: 48, rate: 60, notes: "Framing crew lead, week 1" },
    { date: "2026-07-05", propertyId: "p1", worker: "Danny Reyes", hours: 44, rate: 45, notes: "Framing + demo haul" },
    { date: "2026-07-05", propertyId: "p1", worker: "Sam Oduya", hours: 40, rate: 38, notes: "General labor" },
    { date: "2026-06-28", propertyId: "p1", worker: "Miguel Torres", hours: 52, rate: 60, notes: "Demo week, OT approved" },
    { date: "2026-06-28", propertyId: "p1", worker: "Danny Reyes", hours: 40, rate: 45, notes: "Demo + dumpster runs" },
    { date: "2026-06-21", propertyId: "p2", worker: "Sam Oduya", hours: 36, rate: 38, notes: "Punch list, paint touch-up" },
    { date: "2026-06-21", propertyId: "p2", worker: "Lena Ruiz", hours: 32, rate: 52, notes: "Tile setter, both baths" },
  ];
  for (const p of payroll) {
    const { worker, ...rest } = p;
    await prisma.payrollEntry.create({ data: { ...rest, workerId: workerIds[worker], date: new Date(p.date) } });
  }

  const contributions = [
    { date: "2026-04-02", partnerId: "a1", propertyId: "p1", kind: ContribKind.EQUITY, amount: 180000, description: "Initial equity, Fremont acquisition" },
    { date: "2026-04-02", partnerId: "a2", propertyId: "p1", kind: ContribKind.EQUITY, amount: 120000, description: "Initial equity, Fremont acquisition" },
    { date: "2026-04-04", partnerId: "a3", propertyId: "p1", kind: ContribKind.LOAN, amount: 250000, description: "Bridge loan @ 9.5%, 12mo interest-only" },
    { date: "2026-05-20", partnerId: "a1", propertyId: "p1", kind: ContribKind.EQUITY, amount: 60000, description: "Rehab capital call #1" },
    { date: "2026-02-11", partnerId: "a2", propertyId: "p2", kind: ContribKind.EQUITY, amount: 150000, description: "Initial equity, South SF" },
    { date: "2026-02-11", partnerId: "a3", propertyId: "p2", kind: ContribKind.LOAN, amount: 300000, description: "Hard money, 10.25%" },
    { date: "2026-06-30", partnerId: "a2", propertyId: "p2", kind: ContribKind.DRAW, amount: 40000, description: "Partial return of capital after appraisal" },
    { date: "2025-11-08", partnerId: "a1", propertyId: "p3", kind: ContribKind.EQUITY, amount: 200000, description: "Initial equity, San Jose" },
    { date: "2025-11-08", partnerId: "a3", propertyId: "p3", kind: ContribKind.LOAN, amount: 400000, description: "Acquisition + rehab loan" },
    { date: "2026-05-15", partnerId: "a1", propertyId: "p3", kind: ContribKind.DRAW, amount: 200000, description: "Return of capital at close of escrow" },
  ];
  for (const c of contributions) {
    await prisma.contribution.create({ data: { ...c, date: new Date(c.date) } });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
