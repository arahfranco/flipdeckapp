import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { AddExpenseButton } from "@/components/AddExpenseButton";
import { ExpensesTable } from "@/components/ExpensesTable";

export default async function ExpensesPage() {
  await requireAccessPage("expenses");

  const [expenses, properties] = await Promise.all([
    db.expense.findMany({ include: { property: true }, orderBy: { date: "desc" } }),
    db.property.findMany({ select: { id: true, address: true }, orderBy: { address: "asc" } }),
  ]);

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Ledger</div>
          <h2>Expenses Log</h2>
          <div className="fd-sub">Rolls into rehab actuals per property — see each property's Budget tab.</div>
        </div>
        <AddExpenseButton properties={properties} />
      </header>

      <div className="fd-card">
        <ExpensesTable
          properties={properties}
          expenses={expenses.map((e) => ({
            id: e.id,
            date: e.date.toISOString().slice(0, 10),
            createdAt: e.createdAt.toISOString().slice(0, 10),
            propertyId: e.propertyId,
            propertyAddress: e.property.address,
            description: e.description,
            subcategory: e.subcategory,
            status: e.status,
            amount: e.amount.toString(),
            receiptUrl: e.receiptUrl,
          }))}
        />
      </div>
    </>
  );
}
