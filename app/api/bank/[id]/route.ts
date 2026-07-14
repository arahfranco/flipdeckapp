import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

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
