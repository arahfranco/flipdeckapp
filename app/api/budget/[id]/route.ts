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
  // "actual" is intentionally editable here: it's the fallback the rollup
  // uses only when no expense-log entry exists for the subcategory (spec §2,
  // rule 2). An expense entry will still override whatever is stored here.
  for (const key of ["estimated", "actual"]) {
    if (key in body) data[key] = body[key];
  }

  const line = await db.budgetLine.update({ where: { id: params.id }, data });
  return NextResponse.json(line);
}
