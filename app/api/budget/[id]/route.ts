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
  if ("estimated" in body) data.estimated = body.estimated;
  // "actual" is only meaningful to set directly on the Sale Price line —
  // every cost-category line is purely expense-derived (lib/calc.ts ignores
  // this field for anything but "Selling Price"), so allowing it here for
  // cost lines would just silently do nothing.
  if ("actual" in body && existing.category === "Selling Price") data.actual = body.actual;

  const line = await db.budgetLine.update({ where: { id: params.id }, data });
  return NextResponse.json(line);
}
