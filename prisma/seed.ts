import { PrismaClient, Role, Status, ExpenseStatus, ContribKind, TxnDirection } from "@prisma/client";
import { importHash } from "../lib/csvImport";

const prisma = new PrismaClient();

// Ported from the prototype's seed data (FlipDeck (1).jsx) so the dashboards are
// legible immediately — three Bay Area properties, one sold.

// Categories come from lib/constants — the app's own source of truth. This file
// used to keep a second copy, which silently went stale the moment the real list
// changed, seeding names with no matching budget line.
import { CATEGORIES, SUBS_BY_CAT, type Category } from "../lib/constants";

/** estimated/actual per subcategory; anything unlisted seeds at zero. */
type Estimates = Record<string, [number, number]>;

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

  // Every property gets the full checklist at zero, exactly as the app creates
  // one, then these estimates are layered on so the dashboards have something to
  // show. Amounts from categories the new rehab list merged (cabinets and
  // countertops into Kitchen Remodel; paint, permits, cleanup and contingency
  // into Miscellaneous and Permits) are summed rather than dropped.
  const estimates: Record<string, Estimates> = {
    p1: {
      "Purchase Price": [985000, 985000], "Closing Costs": [14000, 13120],
      "Title & Escrow": [6500, 6820], Inspection: [1200, 1450],
      "Demolition and Site Prep": [12000, 13800], Framing: [18000, 21400],
      Roofing: [26000, 24900], Electrical: [22000, 26750], Plumbing: [19000, 18200],
      HVAC: [16500, 0], "Interior Walls and Drywall": [14000, 11600],
      Flooring: [21000, 0], "Kitchen Remodel": [35000, 0],
      "Bathroom Remodels": [9000, 4200], Landscaping: [8000, 0],
      "Miscellaneous and Permits": [45000, 19150],
      "Loan Interest": [42000, 21400], "Property Tax": [11000, 5700],
      Insurance: [4200, 2100], Utilities: [2800, 1640],
      "Listing Commission": [38000, 0], "Buyer Commission": [38000, 0],
      Staging: [9000, 0], "Escrow Fees": [5000, 0], "Sale Price": [1520000, 0],
    },
    p2: {
      "Purchase Price": [720000, 720000], "Closing Costs": [11000, 10400],
      "Title & Escrow": [5200, 5200], Roofing: [18000, 17250],
      Electrical: [15000, 16400], Plumbing: [12000, 12900],
      "Interior Walls and Drywall": [9000, 8700], Flooring: [15000, 16100],
      "Kitchen Remodel": [27500, 29300], "Fixtures and Appliances": [11000, 11300],
      "Bathroom Remodels": [6500, 6300], Landscaping: [6000, 5800],
      "Miscellaneous and Permits": [26500, 12350],
      "Loan Interest": [28000, 26900], "Property Tax": [7500, 7200],
      Insurance: [3200, 3200], "Listing Commission": [26000, 0],
      "Buyer Commission": [26000, 0], Staging: [7500, 7500],
      "Escrow Fees": [3800, 0], "Sale Price": [1075000, 0],
    },
    p3: {
      "Purchase Price": [890000, 890000], "Closing Costs": [13000, 12750],
      "Title & Escrow": [6000, 6000], Framing: [14000, 15900],
      Roofing: [22000, 22400], Electrical: [19000, 20100], Plumbing: [17000, 17800],
      HVAC: [14000, 13600], "Interior Walls and Drywall": [12000, 12300],
      Flooring: [19000, 20500], "Kitchen Remodel": [32000, 34400],
      "Fixtures and Appliances": [9000, 9400], "Bathroom Remodels": [8000, 8150],
      Landscaping: [7500, 8900], "Miscellaneous and Permits": [34000, 14400],
      "Loan Interest": [36000, 39200], "Property Tax": [9500, 10100],
      Insurance: [3800, 3800], "Listing Commission": [33000, 33900],
      "Buyer Commission": [33000, 33900], Staging: [8500, 8500],
      "Escrow Fees": [4500, 4720], "Sale Price": [1350000, 1356000],
    },
  };

  const budget = properties.flatMap((p) =>
    (CATEGORIES as readonly Category[]).flatMap((cat) =>
      SUBS_BY_CAT[cat].map((sub) => {
        const [estimated, actual] = estimates[p.id]?.[sub] ?? [0, 0];
        return { propertyId: p.id, category: cat, subcategory: sub, estimated, actual };
      })
    )
  );
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
    { date: "2026-06-02", propertyId: "p1", amount: 13800, description: "Interior demo, full gut of kitchen + 2 baths", subcategory: "Demolition and Site Prep", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/9f2a" },
    { date: "2026-06-11", propertyId: "p1", amount: 21400, description: "Structural framing, load-bearing wall removal", subcategory: "Framing", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/1c88" },
    { date: "2026-06-18", propertyId: "p1", amount: 24900, description: "Comp shingle tear-off and replace", subcategory: "Roofing", status: ExpenseStatus.PAID, receiptUrl: null },
    { date: "2026-06-25", propertyId: "p1", amount: 26750, description: "Full rewire, new 200A panel", subcategory: "Electrical", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/44b1" },
    { date: "2026-07-01", propertyId: "p1", amount: 18200, description: "Repipe, PEX throughout", subcategory: "Plumbing", status: ExpenseStatus.PENDING, receiptUrl: null },
    { date: "2026-07-06", propertyId: "p1", amount: 11600, description: "Hang + tape, level 4 finish", subcategory: "Interior Walls and Drywall", status: ExpenseStatus.PENDING, receiptUrl: null },
    { date: "2026-07-08", propertyId: "p1", amount: 4200, description: "Vanities and tub deposit", subcategory: "Bathroom Remodels", status: ExpenseStatus.PENDING, receiptUrl: null },
    { date: "2026-05-14", propertyId: "p2", amount: 20400, description: "Shaker cabinets, full kitchen", subcategory: "Kitchen Remodel", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/7d3e" },
    { date: "2026-05-22", propertyId: "p2", amount: 16100, description: "Engineered oak, 1,480 sqft", subcategory: "Flooring", status: ExpenseStatus.PAID, receiptUrl: "https://drive.example/r/2ab0" },
    { date: "2026-06-04", propertyId: "p2", amount: 8900, description: "Quartz slab, install + template", subcategory: "Kitchen Remodel", status: ExpenseStatus.PAID, receiptUrl: null },
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
