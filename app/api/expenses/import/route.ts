import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { ALL_SUBS } from "@/lib/constants";
import { buildExpenseImport, type ImportStatus } from "@/lib/expenseImport";

// Bulk-creates expenses from the template CSV, against one property or, when no
// property is chosen, as general / overhead. Re-validates server-side rather
// than trusting the client's preview.
export async function POST(req: Request) {
  const guard = await requireAccess("expenses");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  // Blank propertyId is allowed — a general / overhead import.
  const propertyId: string | null = body.propertyId || null;
  const csvText: string = body.csvText ?? "";
  const ignoreBlanks: boolean = body.ignoreBlanks ?? true;

  if (propertyId) {
    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Selling Price is revenue, not an expense subcategory — not importable.
  const validSubcats = ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub);

  const result = buildExpenseImport(csvText, validSubcats, { ignoreBlanks });
  if (result.headerError) return NextResponse.json({ error: result.headerError }, { status: 400 });

  // Importable = every valid row. Rows with no date import with a null date and
  // are dated later from the Expenses Log. Only genuinely bad rows are skipped.
  const toCreate: { date: Date | null; subcategory: string; amount: number; description: string; status: ImportStatus }[] =
    [];
  for (const r of result.rows) {
    if (!r.ok && !r.needsDate) continue; // a real error — skip
    toCreate.push({
      date: r.date ? new Date(r.date) : null,
      subcategory: r.subcategory!,
      amount: r.amount!,
      description: r.description || r.subcategory!,
      status: r.status!,
    });
  }

  if (toCreate.length === 0) {
    return NextResponse.json({ error: "No valid rows to import.", errorCount: result.errorCount }, { status: 400 });
  }

  const created = await db.expense.createMany({
    data: toCreate.map((r) => ({ ...r, propertyId })),
  });

  return NextResponse.json({ imported: created.count, skipped: result.errorCount });
}
