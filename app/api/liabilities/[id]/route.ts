import { NextResponse } from "next/server";
import { LiabilityKind } from "@prisma/client";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Lender name is required" }, { status: 400 });
    data.name = name;
  }
  if ("balance" in body) {
    if (Number.isNaN(Number(body.balance))) {
      return NextResponse.json({ error: "A valid balance is required" }, { status: 400 });
    }
    data.balance = Number(body.balance);
  }
  if ("kind" in body) {
    if (!Object.values(LiabilityKind).includes(body.kind)) {
      return NextResponse.json({ error: "Invalid liability kind" }, { status: 400 });
    }
    data.kind = body.kind;
  }
  if ("interestRate" in body) {
    data.interestRate = body.interestRate != null && body.interestRate !== "" ? Number(body.interestRate) : null;
  }
  if ("propertyId" in body) data.propertyId = body.propertyId || null;
  if ("notes" in body) data.notes = body.notes || null;

  const liability = await db.liability.update({ where: { id: params.id }, data });
  return NextResponse.json(liability);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  await db.liability.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
