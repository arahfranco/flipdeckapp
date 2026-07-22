import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { computeNetWorth } from "@/lib/networth";
import { money, money2 } from "@/lib/format";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/constants";
import { Prisma, ContribKind } from "@prisma/client";
import { CashAccountRow } from "@/components/CashAccountRow";
import { AddCashAccountButton } from "@/components/AddCashAccountButton";
import { LiabilityRow } from "@/components/LiabilityRow";
import { AddLiabilityButton } from "@/components/AddLiabilityButton";

export default async function CompanyValuePage() {
  // Gated on "partners", not "portfolio" — this exposes equity positions,
  // which spec §4 deliberately keeps away from Bookkeepers.
  await requireAccessPage("partners");

  const [properties, liabilities, cashAccounts, partners] = await Promise.all([
    db.property.findMany({
      include: { budget: true, expenses: true, payroll: true },
      orderBy: { address: "asc" },
    }),
    db.liability.findMany({ include: { property: true }, orderBy: { balance: "desc" } }),
    db.cashAccount.findMany({ orderBy: { name: "asc" } }),
    db.partner.findMany({ include: { contributions: true }, orderBy: { name: "asc" } }),
  ]);

  const contributions = partners.flatMap((p) =>
    p.contributions.map((c) => ({ partnerId: c.partnerId, kind: c.kind, amount: c.amount }))
  );

  const nw = computeNetWorth(properties, liabilities, cashAccounts, contributions);

  const heldProperties = properties.filter((p) => p.status !== "SOLD");

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Company</div>
          <h2>Company Value</h2>
          <div className="fd-sub">Assets − liabilities across the portfolio. Equity = what the company is worth.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <AddCashAccountButton />
          <AddLiabilityButton properties={heldProperties.map((p) => ({ id: p.id, address: p.address }))} />
        </div>
      </header>

      <div className="fd-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 22 }}>
        <div className="fd-stat">
          <div className="lbl">Total Assets</div>
          <div className="val">{money(nw.totalAssets)}</div>
          <div className="meta">
            {money(nw.propertyValue)} property · {money(nw.cash)} cash
          </div>
        </div>
        <div className="fd-stat">
          <div className="lbl">Total Liabilities</div>
          <div className="val">{money(nw.totalLiabilities)}</div>
          <div className="meta">
            {money(nw.outsideDebt)} outside · {money(nw.partnerLoans)} partner loans
          </div>
        </div>
        <div className="fd-stat" style={{ borderTopColor: "var(--green)" }}>
          <div className="lbl">Company Equity</div>
          <div className={`val ${nw.companyEquity.greaterThanOrEqualTo(0) ? "pos" : "neg"}`}>
            {money(nw.companyEquity)}
          </div>
          <div className="meta">Assets − liabilities</div>
        </div>
        <div className="fd-stat">
          <div className="lbl">Rental Income</div>
          <div className="val">{money(nw.monthlyRent)}<span style={{ fontSize: 13 }}>/mo</span></div>
          <div className="meta">{money(nw.annualRent)} annualized</div>
        </div>
      </div>

      <div className="fd-card" style={{ marginBottom: 22 }}>
        <div className="fd-card-h">
          <h3>Assets — Properties</h3>
        </div>
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Property</th>
                <th>Status</th>
                <th className="num">Value</th>
                <th className="num">Cost Basis</th>
                <th className="num">Unrealized Gain</th>
              </tr>
            </thead>
            <tbody>
              {nw.properties.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    No held properties. Sold properties are excluded — their proceeds show up as cash.
                  </td>
                </tr>
              )}
              {nw.properties.map((p) => (
                <tr key={p.id}>
                  <td>{p.address}</td>
                  <td>
                    <span className={`pill ${STATUS_TONE[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                  </td>
                  <td className="num">
                    {money2(p.value)}
                    {p.valueIsEstimated && (
                      <span className="hint" style={{ display: "block", fontSize: 10 }}>
                        est. sale price — set a market value
                      </span>
                    )}
                  </td>
                  <td className="num">{money2(p.costBasis)}</td>
                  <td className={`num ${p.unrealizedGain.greaterThanOrEqualTo(0) ? "pos" : "neg"}`}>
                    {money2(p.unrealizedGain)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fd-card" style={{ marginBottom: 22 }}>
        <div className="fd-card-h">
          <h3>Assets — Cash on Hand</h3>
        </div>
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Account</th>
                <th className="num">Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cashAccounts.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">
                    No cash accounts yet. Add one to include cash in company value.
                  </td>
                </tr>
              )}
              {cashAccounts.map((a) => (
                <CashAccountRow
                  key={a.id}
                  account={{
                    id: a.id,
                    name: a.name,
                    balance: a.balance.toString(),
                    notes: a.notes,
                    updatedAt: a.updatedAt.toISOString().slice(0, 10),
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fd-card" style={{ marginBottom: 22 }}>
        <div className="fd-card-h">
          <h3>Liabilities — Outside Debt</h3>
        </div>
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Lender</th>
                <th>Type</th>
                <th>Property</th>
                <th className="num">Rate</th>
                <th className="num">Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liabilities.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No outside debt recorded.
                  </td>
                </tr>
              )}
              {liabilities.map((l) => (
                <LiabilityRow
                  key={l.id}
                  liability={{
                    id: l.id,
                    name: l.name,
                    kind: l.kind,
                    balance: l.balance.toString(),
                    interestRate: l.interestRate?.toString() ?? null,
                    propertyId: l.propertyId,
                    propertyAddress: l.property?.address ?? null,
                  }}
                  properties={heldProperties.map((p) => ({ id: p.id, address: p.address }))}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fd-card">
        <div className="fd-card-h">
          <h3>Partner Capital</h3>
        </div>
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Partner</th>
                <th className="num">Equity (net of draws)</th>
                <th className="num">Loans to company</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => {
                const equity = partner.contributions.reduce((s, c) => {
                  if (c.kind === ContribKind.EQUITY) return s.plus(c.amount);
                  if (c.kind === ContribKind.DRAW) return s.minus(c.amount);
                  return s;
                }, new Prisma.Decimal(0));
                const loans = partner.contributions
                  .filter((c) => c.kind === ContribKind.LOAN)
                  .reduce((s, c) => s.plus(c.amount), new Prisma.Decimal(0));
                return (
                  <tr key={partner.id}>
                    <td>{partner.name}</td>
                    <td className={`num ${equity.greaterThanOrEqualTo(0) ? "pos" : "neg"}`}>{money2(equity)}</td>
                    <td className="num">{money2(loans)}</td>
                  </tr>
                );
              })}
              <tr className="grp">
                <td>Total</td>
                <td className="num">{money2(nw.partnerEquity)}</td>
                <td className="num">{money2(nw.partnerLoans)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="fd-card-b" style={{ borderTop: "1px solid var(--rule-2)" }}>
          <p className="hint">
            Partner loans are money the company owes, so they count as liabilities above. Partner equity is
            owner capital and is not debt.
          </p>
        </div>
      </div>
    </>
  );
}
