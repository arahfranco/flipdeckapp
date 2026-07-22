import Link from "next/link";
import { Decimal } from "@prisma/client/runtime/library";
import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { ALL_SUBS } from "@/lib/constants";
import { money2 } from "@/lib/format";
import { accountBalance } from "@/lib/networth";
import { BankRow } from "@/components/BankRow";
import { AddBankTxnButton } from "@/components/AddBankTxnButton";
import { ImportCsvButton } from "@/components/ImportCsvButton";

export default async function BankPage() {
  await requireAccessPage("bank");

  const [txns, properties, accounts] = await Promise.all([
    db.bankTxn.findMany({ include: { property: true, bankAccount: true }, orderBy: { date: "desc" } }),
    db.property.findMany({ select: { id: true, address: true }, orderBy: { address: "asc" } }),
    db.bankAccount.findMany({ include: { transactions: true }, orderBy: { name: "asc" } }),
  ]);

  // Selling Price is revenue, not an expense subcategory — not offered here.
  const subcategories = ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub);

  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));
  const balances = accounts.map(accountBalance);
  const totalCash = balances.reduce((s, b) => s.plus(b.balance), new Decimal(0));

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Reconciliation</div>
          <h2>Money In &amp; Out</h2>
          <div className="fd-sub">
            Every transaction belongs to a bank account. Post money out to a property expense, money in to
            property income — the account balances below are derived from these rows.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <AddBankTxnButton accounts={accountOptions} />
          <ImportCsvButton accounts={accountOptions} />
        </div>
      </header>

      {accounts.length === 0 ? (
        <div className="fd-card" style={{ marginBottom: 18 }}>
          <p className="empty" style={{ padding: "18px 0" }}>
            No bank accounts yet — add one on the{" "}
            <Link href="/company" className="linkish">
              Company Value
            </Link>{" "}
            page before importing or adding transactions.
          </p>
        </div>
      ) : (
        <div className="kpis" style={{ marginBottom: 18 }}>
          {balances.map((b) => (
            <div className="kpi" key={b.id}>
              <div className="k-l">{b.name}</div>
              <div className={`k-v ${b.balance.isNegative() ? "neg" : ""}`}>{money2(b.balance.toNumber())}</div>
              <div className="k-s">
                +{money2(b.moneyIn.toNumber())} in · −{money2(b.moneyOut.toNumber())} out
              </div>
            </div>
          ))}
          {balances.length > 1 && (
            <div className="kpi">
              <div className="k-l">Total Cash on Hand</div>
              <div className="k-v">{money2(totalCash.toNumber())}</div>
              <div className="k-s">across {balances.length} accounts</div>
            </div>
          )}
        </div>
      )}

      <div className="fd-card">
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Account</th>
                <th>Direction</th>
                <th>Property</th>
                <th>Category</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No transactions yet.
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
                    accountId: t.accountId,
                    accountName: t.bankAccount.name,
                    amount: t.amount.toString(),
                    direction: t.direction,
                    propertyId: t.propertyId,
                    propertyAddress: t.property?.address ?? null,
                    subcategory: t.subcategory,
                    reconciled: t.reconciled,
                  }}
                  properties={properties}
                  accounts={accountOptions}
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
