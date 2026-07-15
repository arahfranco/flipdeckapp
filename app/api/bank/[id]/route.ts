import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { importHash } from "@/lib/csvImport";

// Editing core fields (date/description/amount/account) is only allowed
// while unposted — once posted, those values are baked into the linked
// Expense's own fields, so changing them here would desync the two.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const txn = await db.bankTxn.findUnique({ where: { id: params.id } });
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (txn.reconciled) {
    return NextResponse.json({ error: "Can't edit a posted transaction — delete and re-add instead" }, { status: 409 });
  }

  const body = await req.json();
  const date = body.date ?? txn.date.toISOString().slice(0, 10);
  const description = body.description ?? txn.description;
  const amount = body.amount != null ? Number(body.amount) : txn.amount.toNumber();
  const account = body.account ?? txn.account;

  const hash = importHash(date, amount, description);
  const clashing = await db.bankTxn.findFirst({ where: { importHash: hash, id: { not: params.id } } });
  if (clashing) {
    return NextResponse.json({ error: "A transaction with this date, amount, and description already exists" }, { status: 409 });
  }

  const updated = await db.bankTxn.update({
    where: { id: params.id },
    data: { date: new Date(date), description, amount, account, importHash: hash },
  });
  return NextResponse.json(updated);
}

// Deleting a posted transaction is the dangerous operation (spec §5, §6e):
// it already created an Expense that's inflating a property's actuals.
// Deleting only the bank row would leave an orphaned expense and silently
// wrong numbers, so the paired expense (found via the bankTxnId FK, not
// field-matching like the prototype had to) is deleted in the same transaction.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const txn = await db.bankTxn.findUnique({ where: { id: params.id }, include: { expense: true } });
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (txn.expense) {
    await db.$transaction([
      db.expense.delete({ where: { id: txn.expense.id } }),
      db.bankTxn.delete({ where: { id: params.id } }),
    ]);
  } else {
    await db.bankTxn.delete({ where: { id: params.id } });
  }

  return NextResponse.json({ ok: true });
}
