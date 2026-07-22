import { NextResponse } from "next/server";
import { IncomeCategory, TxnDirection } from "@prisma/client";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

// Assign a property, then post. An OUT transaction creates an Expense (and
// needs a budget subcategory); an IN transaction creates an Income (and needs
// an income category instead). Both link back via bankTxnId so the pair can
// never be orphaned — spec §5/§6e.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { propertyId, subcategory, category } = body;
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }

  const txn = await db.bankTxn.findUnique({ where: { id: params.id } });
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (txn.reconciled) return NextResponse.json({ error: "Already posted" }, { status: 409 });

  if (txn.direction === TxnDirection.IN) {
    if (category && !Object.values(IncomeCategory).includes(category)) {
      return NextResponse.json({ error: "Invalid income category" }, { status: 400 });
    }
    const [, income] = await db.$transaction([
      db.bankTxn.update({ where: { id: params.id }, data: { propertyId, reconciled: true } }),
      db.income.create({
        data: {
          propertyId,
          date: txn.date,
          amount: txn.amount,
          description: txn.description,
          category: category ?? IncomeCategory.RENT,
          bankTxnId: params.id,
        },
      }),
    ]);
    return NextResponse.json(income, { status: 201 });
  }

  if (!subcategory) {
    return NextResponse.json({ error: "subcategory is required for money out" }, { status: 400 });
  }
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
