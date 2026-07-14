import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Powers the delete confirmation dialog — spec §5 is explicit that this must
// enumerate exactly what's destroyed (with dollar totals), not a generic
// "Are you sure?". Bank transactions are NOT included as destroyed: they're
// un-assigned, not deleted (the money genuinely left the account).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("properties");
  if ("error" in guard) return guard.error;

  const [budgetLines, expenses, payroll, contributions, bankTxns] = await Promise.all([
    db.budgetLine.count({ where: { propertyId: params.id } }),
    db.expense.aggregate({ where: { propertyId: params.id }, _count: true, _sum: { amount: true } }),
    db.payrollEntry.findMany({ where: { propertyId: params.id }, select: { hours: true, rate: true } }),
    db.contribution.aggregate({ where: { propertyId: params.id }, _count: true, _sum: { amount: true } }),
    db.bankTxn.count({ where: { propertyId: params.id } }),
  ]);

  const payrollTotal = payroll.reduce((s, p) => s.plus(p.hours.times(p.rate)), new Prisma.Decimal(0));

  return NextResponse.json({
    budgetLines,
    expenses: { count: expenses._count, total: (expenses._sum.amount ?? new Prisma.Decimal(0)).toString() },
    payroll: { count: payroll.length, total: payrollTotal.toString() },
    contributions: {
      count: contributions._count,
      total: (contributions._sum.amount ?? new Prisma.Decimal(0)).toString(),
    },
    bankTxnsToUnassign: bankTxns,
  });
}
