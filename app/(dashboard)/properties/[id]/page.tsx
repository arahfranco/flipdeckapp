import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { computeProperty } from "@/lib/calc";
import { money, money2, pct } from "@/lib/format";
import { CAN_SEE, CATEGORIES, COST_CATEGORIES, STATUS_LABELS, STATUS_TONE, EXPENSE_STATUS_LABELS } from "@/lib/constants";
import { DeletePropertyButton } from "@/components/DeletePropertyButton";
import { BudgetLineRow } from "@/components/BudgetLineRow";

type Tab = "dashboard" | "budget" | "expenses" | "payroll" | "capital";

const TAB_SECTION: Record<Tab, "properties" | "expenses" | "payroll" | "partners"> = {
  dashboard: "properties",
  budget: "properties",
  expenses: "expenses",
  payroll: "payroll",
  capital: "partners",
};

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const session = await requireAccessPage("properties");
  const allowed = CAN_SEE[session.user.role] ?? [];

  const property = await db.property.findUnique({
    where: { id: params.id },
    include: {
      budget: true,
      expenses: { orderBy: { date: "desc" } },
      payroll: { orderBy: { date: "desc" } },
      contributions: { include: { partner: true }, orderBy: { date: "desc" } },
    },
  });
  if (!property) notFound();

  const tabs: Tab[] = (["dashboard", "budget", "expenses", "payroll", "capital"] as Tab[]).filter((t) =>
    allowed.includes(TAB_SECTION[t])
  );
  const requested = (searchParams.tab as Tab) ?? "dashboard";
  const activeTab: Tab = tabs.includes(requested) ? requested : tabs[0];

  const result = computeProperty(property.budget, property.expenses, property.payroll);

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">
            <Link href="/properties">Properties</Link> / {STATUS_LABELS[property.status]}
          </div>
          <h2>{property.address}</h2>
          <div className="fd-sub">
            {property.beds} bd · {property.baths} ba · {property.sqft.toLocaleString()} sqft
            {property.mls ? ` · MLS ${property.mls}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <span className={`pill ${STATUS_TONE[property.status]}`}>{STATUS_LABELS[property.status]}</span>
          <DeletePropertyButton propertyId={property.id} address={property.address} />
        </div>
      </header>

      <div className="toolbar" style={{ marginBottom: 20 }}>
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/properties/${property.id}?tab=${t}`}
            className={`fd-btn ${activeTab === t ? "" : "ghost"} sm`}
            style={{ textTransform: "capitalize" }}
          >
            {t}
          </Link>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <>
          <div className="fd-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 22 }}>
            <div className="fd-stat">
              <div className="lbl">{result.sold ? "Actual Profit" : "Projected Profit"}</div>
              <div className={`val ${result.actProfit.greaterThanOrEqualTo(0) ? "pos" : "neg"}`}>
                {money(result.actProfit)}
              </div>
            </div>
            <div className="fd-stat">
              <div className="lbl">Margin</div>
              <div className={`val ${result.actMargin >= 0 ? "pos" : "neg"}`}>{pct(result.actMargin)}</div>
            </div>
            <div className="fd-stat">
              <div className="lbl">Total Cost</div>
              <div className="val">{money(result.totalActCost)}</div>
            </div>
            <div className="fd-stat">
              <div className="lbl">{result.sold ? "Sale Price" : "Target Price"}</div>
              <div className="val">{money(result.priceBasis)}</div>
            </div>
          </div>

          <div className="fd-card">
            <div className="fd-card-h">
              <h3>Category Rollup</h3>
            </div>
            <div className="fd-tw">
              <table className="fd-t">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Estimated</th>
                    <th className="num">Actual</th>
                    <th className="num">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map((cat) => {
                    const c = result.byCat[cat];
                    // Selling Price is revenue: exceeding the target is good, so
                    // variance is actual − estimated (opposite direction from costs).
                    const variance = c.actual.minus(c.estimated);
                    const varianceIsGood = COST_CATEGORIES.includes(cat) ? variance.lessThanOrEqualTo(0) : variance.greaterThanOrEqualTo(0);
                    return (
                      <tr key={cat}>
                        <td>{cat}</td>
                        <td className="num">{money(c.estimated)}</td>
                        <td className="num">{money(c.actual)}</td>
                        <td className={`num ${varianceIsGood ? "pos" : "neg"}`}>{money(variance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "budget" && (
        <div className="fd-card">
          <div className="fd-card-h">
            <h3>Budget</h3>
          </div>
          <div className="fd-tw">
            <table className="fd-t">
              <thead>
                <tr>
                  <th>Subcategory</th>
                  <th className="num">Estimated</th>
                  <th className="num">Actual</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat) => (
                  <Fragment key={cat}>
                    <tr className="grp">
                      <td colSpan={3}>{cat}</td>
                    </tr>
                    {result.byCat[cat].rows.map((row) => (
                      <BudgetLineRow
                        key={row.id}
                        id={row.id}
                        subcategory={row.subcategory}
                        estimated={row.estimated.toString()}
                        actual={row.actual.toString()}
                        derived={row.derived}
                        actualIsOverridden={Boolean(row.overridden)}
                      />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "expenses" && (
        <div className="fd-card">
          <div className="fd-card-h">
            <h3>Expenses Log</h3>
          </div>
          <div className="fd-tw">
            <table className="fd-t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Subcategory</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {property.expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No expenses logged yet.
                    </td>
                  </tr>
                )}
                {property.expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{e.date.toISOString().slice(0, 10)}</td>
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
      )}

      {activeTab === "payroll" && (
        <div className="fd-card">
          <div className="fd-card-h">
            <h3>Payroll Log</h3>
          </div>
          <div className="fd-tw">
            <table className="fd-t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Worker</th>
                  <th className="num">Hours</th>
                  <th className="num">Rate</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {property.payroll.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No payroll entries yet.
                    </td>
                  </tr>
                )}
                {property.payroll.map((p) => (
                  <tr key={p.id}>
                    <td>{p.date.toISOString().slice(0, 10)}</td>
                    <td>{p.worker}</td>
                    <td className="num">{p.hours.toString()}</td>
                    <td className="num">{money2(p.rate)}</td>
                    <td className="num">{money2(p.hours.times(p.rate))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "capital" && (
        <div className="fd-card">
          <div className="fd-card-h">
            <h3>Partner Contributions</h3>
          </div>
          <div className="fd-tw">
            <table className="fd-t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Partner</th>
                  <th>Kind</th>
                  <th>Description</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {property.contributions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No contributions logged yet.
                    </td>
                  </tr>
                )}
                {property.contributions.map((c) => (
                  <tr key={c.id}>
                    <td>{c.date.toISOString().slice(0, 10)}</td>
                    <td>{c.partner.name}</td>
                    <td>
                      <span className={`pill p-${c.kind.toLowerCase()}`}>{c.kind}</span>
                    </td>
                    <td>{c.description}</td>
                    <td className={`num ${c.kind === "DRAW" ? "neg" : ""}`}>
                      {c.kind === "DRAW" ? "−" : ""}
                      {money2(c.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
