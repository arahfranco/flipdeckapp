import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { ALL_SUBS } from "@/lib/constants";
import { BankRow } from "@/components/BankRow";
import { AddBankTxnButton } from "@/components/AddBankTxnButton";
import { ImportCsvButton } from "@/components/ImportCsvButton";

export default async function BankPage() {
  await requireAccessPage("bank");

  const [txns, properties] = await Promise.all([
    db.bankTxn.findMany({ include: { property: true }, orderBy: { date: "desc" } }),
    db.property.findMany({ select: { id: true, address: true }, orderBy: { address: "asc" } }),
  ]);

  // Selling Price is revenue, not an expense subcategory — not offered here.
  const subcategories = ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub);

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Reconciliation</div>
          <h2>Bank Transactions</h2>
          <div className="fd-sub">Assign a property + subcategory and post to create an expense.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <AddBankTxnButton />
          <ImportCsvButton />
        </div>
      </header>

      <div className="fd-card">
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Account</th>
                <th>Property</th>
                <th>Subcategory</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No transactions imported yet.
                  </td>
                </tr>
              )}
              {txns.map((t) => (
                <BankRow
                  key={t.id}
                  txn={{
                    id: t.id,
                    date: t.date.toISOString().slice(0, 10),
                    description: t.description,
                    account: t.account,
                    amount: t.amount.toString(),
                    propertyId: t.propertyId,
                    propertyAddress: t.property?.address ?? null,
                    subcategory: t.subcategory,
                    reconciled: t.reconciled,
                  }}
                  properties={properties}
                  subcategories={subcategories}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
