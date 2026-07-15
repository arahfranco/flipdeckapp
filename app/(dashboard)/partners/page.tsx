import Link from "next/link";
import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { money2 } from "@/lib/format";
import { Prisma } from "@prisma/client";
import { AddContributionButton } from "@/components/AddContributionButton";
import { ContributionRow } from "@/components/ContributionRow";

export default async function PartnersPage() {
  await requireAccessPage("partners");

  const [partners, properties] = await Promise.all([
    db.partner.findMany({ include: { contributions: { include: { property: true }, orderBy: { date: "desc" } } } }),
    db.property.findMany({ select: { id: true, address: true }, orderBy: { address: "asc" } }),
  ]);

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Capital</div>
          <h2>Partner Contributions</h2>
          <div className="fd-sub">Net capital = Equity + Loan − Draw. Draws are negative in every rollup.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/partners/manage" className="fd-btn ghost sm">
            Manage Partners
          </Link>
          <AddContributionButton partners={partners} properties={properties} />
        </div>
      </header>

      <div className="fd-grid" style={{ gridTemplateColumns: `repeat(${partners.length || 1}, 1fr)`, marginBottom: 22 }}>
        {partners.map((partner) => {
          const net = partner.contributions.reduce((s, c) => {
            const sign = c.kind === "DRAW" ? -1 : 1;
            return s.plus(c.amount.times(sign));
          }, new Prisma.Decimal(0));
          return (
            <div className="fd-stat" key={partner.id}>
              <div className="lbl">{partner.name}</div>
              <div className={`val ${net.greaterThanOrEqualTo(0) ? "pos" : "neg"}`}>{money2(net)}</div>
            </div>
          );
        })}
      </div>

      <div className="fd-card">
        <div className="fd-card-h">
          <h3>Ledger</h3>
        </div>
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Date</th>
                <th>Partner</th>
                <th>Property</th>
                <th>Kind</th>
                <th>Description</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {partners.flatMap((p) => p.contributions).length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No contributions logged yet.
                  </td>
                </tr>
              )}
              {partners
                .flatMap((p) => p.contributions.map((c) => ({ ...c, partnerName: p.name })))
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map((c) => (
                  <ContributionRow
                    key={c.id}
                    contribution={{
                      id: c.id,
                      date: c.date.toISOString().slice(0, 10),
                      partnerId: c.partnerId,
                      partnerName: c.partnerName,
                      propertyId: c.propertyId,
                      propertyAddress: c.property.address,
                      kind: c.kind,
                      description: c.description,
                      amount: c.amount.toString(),
                    }}
                    partners={partners.map((p) => ({ id: p.id, name: p.name }))}
                    properties={properties}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
