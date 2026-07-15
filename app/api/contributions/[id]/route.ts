import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["kind", "amount", "description", "partnerId", "propertyId"]) {
    if (key in body) data[key] = body[key];
  }
  if (body.date) data.date = new Date(body.date);

  const contribution = await db.contribution.update({ where: { id: params.id }, data });
  return NextResponse.json(contribution);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  await db.contribution.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
