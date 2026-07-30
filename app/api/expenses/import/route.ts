import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { ALL_SUBS } from "@/lib/constants";
import { buildExpenseImport } from "@/lib/expenseImport";

// Bulk-creates expenses from the template CSV, all against one property.
// Re-validates server-side rather than trusting the client's preview.
export async function POST(req: Request) {
  const guard = await requireAccess("expenses");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const propertyId: string = body.propertyId ?? "";
  const csvText: string = body.csvText ?? "";

  if (!propertyId) return NextResponse.json({ error: "Pick a property first" }, { status: 400 });
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  // Selling Price is revenue, not an expense subcategory — not importable.
  const validSubcats = ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub);

  const result = buildExpenseImport(csvText, validSubcats);
  if (result.headerError) return NextResponse.json({ error: result.headerError }, { status: 400 });

  const ok = result.rows.filter((r) => r.ok);
  if (ok.length === 0) {
    return NextResponse.json({ error: "No valid rows to import.", errorCount: result.errorCount }, { status: 400 });
  }

  const created = await db.expense.createMany({
    data: ok.map((r) => ({
      date: new Date(r.date!),
      propertyId,
      subcategory: r.subcategory!,
      amount: r.amount!,
      description: r.description || r.subcategory!,
      status: r.status!,
    })),
  });

  return NextResponse.json({ imported: created.count, skipped: result.errorCount });
}
