import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

// Gated on "partners" — cash balances are part of the company's equity
// picture, which spec §4 deliberately keeps away from Bookkeepers.
export async function POST(req: Request) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (body.balance == null || Number.isNaN(Number(body.balance))) {
    return NextResponse.json({ error: "A valid balance is required" }, { status: 400 });
  }

  const account = await db.cashAccount.create({
    data: { name, balance: Number(body.balance), notes: body.notes || null },
  });
  return NextResponse.json(account, { status: 201 });
}
