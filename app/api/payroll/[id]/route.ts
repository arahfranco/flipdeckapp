import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("payroll");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["workerId", "propertyId", "hours", "rate", "notes"]) {
    if (key in body) data[key] = body[key];
  }
  if (body.date) data.date = new Date(body.date);

  const entry = await db.payrollEntry.update({ where: { id: params.id }, data });
  return NextResponse.json(entry);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("payroll");
  if ("error" in guard) return guard.error;

  await db.payrollEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
