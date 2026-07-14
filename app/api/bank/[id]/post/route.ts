import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

// Assign property + subcategory, then post — creates an Expense linked via
// bankTxnId, which then flows through the rollup like any other expense
// (spec §2, rule 4; §5 Bank Transactions).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { propertyId, subcategory } = body;
  if (!propertyId || !subcategory) {
    return NextResponse.json({ error: "propertyId and subcategory are required" }, { status: 400 });
  }

  const txn = await db.bankTxn.findUnique({ where: { id: params.id } });
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (txn.reconciled) return NextResponse.json({ error: "Already posted" }, { status: 409 });

  const [, expense] = await db.$transaction([
    db.bankTxn.update({ where: { id: params.id }, data: { propertyId, subcategory, reconciled: true } }),
    db.expense.create({
      data: {
        propertyId,
        subcategory,
        date: txn.date,
        amount: txn.amount,
        description: txn.description,
        status: "PAID",
        bankTxnId: params.id,
      },
    }),
  ]);

  return NextResponse.json(expense, { status: 201 });
}
