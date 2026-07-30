import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { ALL_SUBS } from "@/lib/constants";
import { buildExpenseImport, type ImportStatus } from "@/lib/expenseImport";
import { normDate } from "@/lib/csvImport";

// Bulk-creates expenses from the template CSV, all against one property.
// Re-validates server-side rather than trusting the client's preview.
export async function POST(req: Request) {
  const guard = await requireAccess("expenses");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const propertyId: string = body.propertyId ?? "";
  const csvText: string = body.csvText ?? "";
  const ignoreBlanks: boolean = body.ignoreBlanks ?? true;
  // Dates the user filled in the preview for rows whose date was blank,
  // keyed by 1-based line number. Re-validated here, not trusted blindly.
  const filledDates: Record<string, string> = body.dates ?? {};

  if (!propertyId) return NextResponse.json({ error: "Pick a property first" }, { status: 400 });
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  // Selling Price is revenue, not an expense subcategory — not importable.
  const validSubcats = ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub);

  const result = buildExpenseImport(csvText, validSubcats, { ignoreBlanks });
  if (result.headerError) return NextResponse.json({ error: result.headerError }, { status: 400 });

  // Importable = rows that already had a date, plus needs-a-date rows for which
  // the preview supplied a valid one. Everything else is skipped.
  const toCreate: { date: Date; subcategory: string; amount: number; description: string; status: ImportStatus }[] =
    [];
  for (const r of result.rows) {
    let date: string | null = null;
    if (r.ok) date = r.date!;
    else if (r.needsDate) date = normDate(filledDates[String(r.line)] ?? "");
    if (!date) continue;
    toCreate.push({
      date: new Date(date),
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
