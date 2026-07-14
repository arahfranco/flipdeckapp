import Link from "next/link";
import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { computeProperty } from "@/lib/calc";
import { money } from "@/lib/format";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/constants";

export default async function PropertiesPage() {
  await requireAccessPage("properties");

  const properties = await db.property.findMany({
    include: { budget: true, expenses: true, payroll: true },
    orderBy: { address: "asc" },
  });

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Properties</div>
          <h2>All Properties</h2>
        </div>
      </header>

      {properties.length === 0 ? (
        <div className="empty">
          <b>No properties yet</b>
          Properties you add will show up here.
        </div>
      ) : (
        <div className="fd-props">
          {properties.map((property) => {
            const result = computeProperty(property.budget, property.expenses, property.payroll);
            return (
              <Link key={property.id} href={`/properties/${property.id}`} className="fd-prop">
                {property.photoUrl && <img src={property.photoUrl} alt={property.address} />}
                <div className="fd-prop-b">
                  <div className="addr">{property.address}</div>
                  <div className="specs">
                    {property.beds} bd · {property.baths} ba · {property.sqft.toLocaleString()} sqft
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span className={`pill ${STATUS_TONE[property.status]}`}>{STATUS_LABELS[property.status]}</span>
                  </div>
                  <div className="fd-prof">
                    <div>
                      <div className="k">{result.sold ? "Realized Profit" : "Projected Profit"}</div>
                      <div className={`v ${result.actProfit.greaterThanOrEqualTo(0) ? "pos" : "neg"}`}>
                        {money(result.actProfit)}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
