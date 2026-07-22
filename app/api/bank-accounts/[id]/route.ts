import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Account name is required" }, { status: 400 });
    data.name = name;
  }
  // The balance itself is never settable — it's derived from transactions.
  // Only the starting point can be adjusted.
  if ("openingBalance" in body) {
    const opening = body.openingBalance === "" || body.openingBalance == null ? 0 : Number(body.openingBalance);
    if (Number.isNaN(opening)) {
      return NextResponse.json({ error: "Opening balance must be a number" }, { status: 400 });
    }
    data.openingBalance = opening;
  }
  if ("notes" in body) data.notes = body.notes || null;

  try {
    const account = await db.bankAccount.update({ where: { id: params.id }, data });
    return NextResponse.json(account);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "An account with that name already exists" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  // Blocked while transactions reference it — deleting would orphan real
  // financial history, the same rule used for Workers and Partners.
  const count = await db.bankTxn.count({ where: { accountId: params.id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `Can't delete — ${count} transaction${count === 1 ? "" : "s"} belong to this account` },
      { status: 409 }
    );
  }

  await db.bankAccount.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
