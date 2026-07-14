import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { partnerId, propertyId, date, kind, amount, description } = body;
  if (!partnerId || !propertyId || !date || !kind || amount == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["EQUITY", "LOAN", "DRAW"].includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const contribution = await db.contribution.create({
    data: { partnerId, propertyId, date: new Date(date), kind, amount, description: description || null },
  });
  return NextResponse.json(contribution, { status: 201 });
}
