import { NextResponse } from "next/server";
import { LiabilityKind } from "@prisma/client";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Lender name is required" }, { status: 400 });
  if (body.balance == null || Number.isNaN(Number(body.balance))) {
    return NextResponse.json({ error: "A valid balance is required" }, { status: 400 });
  }
  if (body.kind && !Object.values(LiabilityKind).includes(body.kind)) {
    return NextResponse.json({ error: "Invalid liability kind" }, { status: 400 });
  }

  const liability = await db.liability.create({
    data: {
      name,
      kind: body.kind ?? LiabilityKind.OTHER,
      balance: Number(body.balance),
      interestRate: body.interestRate != null && body.interestRate !== "" ? Number(body.interestRate) : null,
      // null = company-level debt, not tied to a single property
      propertyId: body.propertyId || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(liability, { status: 201 });
}
