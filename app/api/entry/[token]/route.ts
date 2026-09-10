import { NextResponse } from "next/server";
import { ExpenseStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ALL_SUBS } from "@/lib/constants";
import { resolveEntryCompany } from "@/lib/entryLink";

// Public, token-gated expense submission for the field team — NO login. The
// unguessable token in the path is the only gate; the Owner can disable or
// rotate it from Company Settings. Everything is validated here, not trusted.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const company = await resolveEntryCompany(params.token);
  if (!company) {
    return NextResponse.json({ error: "This entry link is no longer active." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Amount: a finite positive number, with a sane ceiling to blunt abuse.
  const amount = Number(body.amount);
  if (!isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  // Subcategory must be one of the real expense subcategories (Selling Price is
  // revenue, not importable).
  const validSubs = new Set(ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub));
  const subcategory = String(body.subcategory ?? "");
  if (!validSubs.has(subcategory)) {
    return NextResponse.json({ error: "Pick a category." }, { status: 400 });
  }

  // Status defaults to Pending; anything unexpected is coerced to it.
  const status = Object.values(ExpenseStatus).includes(body.status) ? (body.status as ExpenseStatus) : "PENDING";

  // Date is optional — a blank one is fine and gets filled later in the log.
  let date: Date | null = null;
  if (body.date) {
    const d = new Date(String(body.date));
    if (!isNaN(d.getTime())) date = d;
  }

  // A real property, or general/overhead when blank.
  let propertyId: string | null = body.propertyId ? String(body.propertyId) : null;
  if (propertyId) {
    const exists = await db.property.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!exists) propertyId = null;
  }

  const description = String(body.description ?? "").trim().slice(0, 300) || subcategory;

  await db.expense.create({
    data: {
      propertyId,
      date,
      amount,
      description,
      subcategory,
      status,
      receiptUrl: body.receiptUrl ? String(body.receiptUrl) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
