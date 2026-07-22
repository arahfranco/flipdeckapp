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
  const accountId = body.accountId ?? txn.accountId;
  const direction = body.direction ?? txn.direction;

  const hash = importHash(accountId, date, amount, direction, description);
  const clashing = await db.bankTxn.findFirst({ where: { importHash: hash, id: { not: params.id } } });
  if (clashing) {
    return NextResponse.json(
      { error: "That account already has a transaction with this date, amount, direction, and description" },
      { status: 409 }
    );
  }

  const updated = await db.bankTxn.update({
    where: { id: params.id },
    data: { date: new Date(date), description, amount, accountId, direction, importHash: hash },
  });
  return NextResponse.json(updated);
}

// Deleting a posted transaction is the dangerous operation (spec §5, §6e):
// it already created an Expense inflating a property's actuals, or an Income
// inflating its receipts. Deleting only the bank row would leave that orphaned
// and the numbers silently wrong, so the paired record (found via the
// bankTxnId FK, not field-matching like the prototype had to) goes in the
// same transaction.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const txn = await db.bankTxn.findUnique({
    where: { id: params.id },
    include: { expense: true, income: true },
  });
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.$transaction([
    ...(txn.expense ? [db.expense.delete({ where: { id: txn.expense.id } })] : []),
    ...(txn.income ? [db.income.delete({ where: { id: txn.income.id } })] : []),
    db.bankTxn.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
