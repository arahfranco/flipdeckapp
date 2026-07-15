import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { importHash } from "@/lib/csvImport";

export async function POST(req: Request) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { date, description, amount, account } = body;
  if (!date || !description || amount == null || !account) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hash = importHash(date, Number(amount), description);
  const existing = await db.bankTxn.findUnique({ where: { importHash: hash } });
  if (existing) {
    return NextResponse.json({ error: "A transaction with this date, amount, and description already exists" }, { status: 409 });
  }

  const txn = await db.bankTxn.create({
    data: { date: new Date(date), description, amount, account, importHash: hash },
  });
  return NextResponse.json(txn, { status: 201 });
}
