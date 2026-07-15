import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("expenses");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["amount", "description", "subcategory", "status", "receiptUrl", "propertyId"]) {
    if (key in body) data[key] = body[key];
  }
  if (body.date) data.date = new Date(body.date);

  const expense = await db.expense.update({ where: { id: params.id }, data });
  return NextResponse.json(expense);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("expenses");
  if ("error" in guard) return guard.error;

  const expense = await db.expense.findUnique({ where: { id: params.id } });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If this expense was created by posting a bank transaction, deleting it
  // must also un-post the bank row — otherwise the bank txn stays marked
  // "reconciled" with no expense behind it, the same orphan problem the
  // property-delete cascade and bank-delete route both guard against.
  if (expense.bankTxnId) {
    await db.$transaction([
      db.expense.delete({ where: { id: params.id } }),
      db.bankTxn.update({
        where: { id: expense.bankTxnId },
        data: { propertyId: null, subcategory: null, reconciled: false },
      }),
    ]);
  } else {
    await db.expense.delete({ where: { id: params.id } });
  }

  return NextResponse.json({ ok: true });
}
