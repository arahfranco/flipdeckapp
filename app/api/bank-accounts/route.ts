import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

// Accounts are managed from the Company Value page (equity picture), so they
// use the "partners" gate rather than "bank".
export async function POST(req: Request) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Account name is required" }, { status: 400 });

  const opening =
    body.openingBalance == null || body.openingBalance === "" ? 0 : Number(body.openingBalance);
  if (Number.isNaN(opening)) {
    return NextResponse.json({ error: "Opening balance must be a number" }, { status: 400 });
  }

  try {
    const account = await db.bankAccount.create({
      data: { name, openingBalance: opening, notes: body.notes || null },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "An account with that name already exists" }, { status: 409 });
    }
    throw e;
  }
}
