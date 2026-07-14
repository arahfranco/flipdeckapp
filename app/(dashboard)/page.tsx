import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { computeProperty } from "@/lib/calc";
import { money, pct } from "@/lib/format";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/constants";
import { Prisma } from "@prisma/client";

export default async function PortfolioPage() {
  await requireAccessPage("portfolio");

  const properties = await db.property.findMany({
    include: { budget: true, expenses: true, payroll: true },
    orderBy: { address: "asc" },
  });

  const partners = await db.partner.findMany({ include: { contributions: true } });

  const computed = properties.map((p) => ({
    property: p,
    result: computeProperty(p.budget, p.expenses, p.payroll),
  }));

  const projectedProfit = computed.reduce((s, c) => s.plus(c.result.estProfit), new Prisma.Decimal(0));
  const realizedProfit = computed
    .filter((c) => c.result.sold)
    .reduce((s, c) => s.plus(c.result.actProfit), new Prisma.Decimal(0));
  const totalCost = computed.reduce((s, c) => s.plus(c.result.totalActCost), new Prisma.Decimal(0));

  const capitalByPartner = partners.map((partner) => {
    const net = partner.contributions.reduce((s, c) => {
      const sign = c.kind === "DRAW" ? -1 : 1;
      return s.plus(c.amount.times(sign));
    }, new Prisma.Decimal(0));
    return { partner, net };
  });
  const capitalDeployed = capitalByPartner.reduce((s, c) => s.plus(c.net), new Prisma.Decimal(0));

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Portfolio</div>
          <h2>Overview</h2>
          <div className="fd-sub">{properties.length} propert{properties.length === 1 ? "y" : "ies"} tracked</div>
        </div>
      </header>

      <div className="fd-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 22 }}>
        <div className="fd-stat">
          <div className="lbl">Projected Profit</div>
          <div className="val">{money(projectedProfit)}</div>
        </div>
        <div className="fd-stat">
          <div className="lbl">Realized Profit (Sold)</div>
          <div className="val">{money(realizedProfit)}</div>
        </div>
        <div className="fd-stat">
          <div className="lbl">Capital Deployed</div>
          <div className="val">{money(capitalDeployed)}</div>
        </div>
        <div className="fd-stat">
          <div className="lbl">Total Cost (Actual)</div>
          <div className="val">{money(totalCost)}</div>
        </div>
      </div>

      <div className="fd-card" style={{ marginBottom: 22 }}>
        <div className="fd-card-h">
          <h3>Profit by Property</h3>
        </div>
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Address</th>
                <th>Status</th>
                <th className="num">Total Cost</th>
                <th className="num">Price Basis</th>
                <th className="num">Profit</th>
                <th className="num">Margin</th>
              </tr>
            </thead>
            <tbody>
              {computed.map(({ property, result }) => (
                <tr key={property.id}>
                  <td>{property.address}</td>
                  <td>
                    <span className={`pill ${STATUS_TONE[property.status]}`}>
                      {STATUS_LABELS[property.status]}
                    </span>
                  </td>
                  <td className="num">{money(result.totalActCost)}</td>
                  <td className="num">{money(result.priceBasis)}</td>
                  <td className={`num ${result.actProfit.greaterThanOrEqualTo(0) ? "pos" : "neg"}`}>
                    {money(result.actProfit)}
                  </td>
                  <td className={`num ${result.actMargin >= 0 ? "pos" : "neg"}`}>{pct(result.actMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fd-card">
        <div className="fd-card-h">
          <h3>Capital by Partner</h3>
        </div>
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Partner</th>
                <th className="num">Net Capital</th>
              </tr>
            </thead>
            <tbody>
              {capitalByPartner.map(({ partner, net }) => (
                <tr key={partner.id}>
                  <td>{partner.name}</td>
                  <td className={`num ${net.greaterThanOrEqualTo(0) ? "pos" : "neg"}`}>{money(net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
