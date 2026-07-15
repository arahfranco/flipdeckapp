import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("properties");
  if ("error" in guard) return guard.error;

  const existing = await db.budgetLine.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  // "actual" is deliberately NOT editable here — it's a pure derived value
  // (the expense-log sum for this subcategory, spec §2 rule 2). Only
  // "estimated" is ever user-entered.
  if ("estimated" in body) data.estimated = body.estimated;

  const line = await db.budgetLine.update({ where: { id: params.id }, data });
  return NextResponse.json(line);
}
