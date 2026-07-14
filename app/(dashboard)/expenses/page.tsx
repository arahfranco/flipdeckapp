import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { money2 } from "@/lib/format";
import { EXPENSE_STATUS_LABELS } from "@/lib/constants";
import { AddExpenseButton } from "@/components/AddExpenseButton";

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
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Date</th>
                <th>Property</th>
                <th>Description</th>
                <th>Subcategory</th>
                <th>Status</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No expenses logged yet.
                  </td>
                </tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.date.toISOString().slice(0, 10)}</td>
                  <td>{e.property.address}</td>
                  <td>{e.description}</td>
                  <td>{e.subcategory}</td>
                  <td>
                    <span className={`pill p-${e.status.toLowerCase()}`}>{EXPENSE_STATUS_LABELS[e.status]}</span>
                  </td>
                  <td className="num">{money2(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
