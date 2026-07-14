import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("expenses");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["amount", "description", "subcategory", "status", "receiptUrl"]) {
    if (key in body) data[key] = body[key];
  }
  if (body.date) data.date = new Date(body.date);

  const expense = await db.expense.update({ where: { id: params.id }, data });
  return NextResponse.json(expense);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("expenses");
  if ("error" in guard) return guard.error;

  // If this expense was created by reconciling a bank transaction, the FK
  // relation (bankTxnId) is how a future "unreconcile" flow would find it —
  // deleting the expense here does not touch the bank txn, matching the
  // property-delete cascade's treatment of bank rows (never silently deleted).
  await db.expense.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
