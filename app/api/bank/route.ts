import { NextResponse } from "next/server";
import { TxnDirection } from "@prisma/client";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { importHash } from "@/lib/csvImport";

export async function POST(req: Request) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { date, description, amount, accountId } = body;
  const direction: TxnDirection = body.direction ?? TxnDirection.OUT;

  if (!date || !description || amount == null || !accountId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!Object.values(TxnDirection).includes(direction)) {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }

  // Amount is always stored POSITIVE — direction carries the sign.
  const magnitude = Math.abs(Number(amount));
  const hash = importHash(accountId, date, magnitude, direction, description);
  const existing = await db.bankTxn.findUnique({ where: { importHash: hash } });
  if (existing) {
    return NextResponse.json(
      { error: "That account already has a transaction with this date, amount, direction, and description" },
      { status: 409 }
    );
  }

  const txn = await db.bankTxn.create({
    data: { date: new Date(date), description, amount: magnitude, direction, accountId, importHash: hash },
  });
  return NextResponse.json(txn, { status: 201 });
}
