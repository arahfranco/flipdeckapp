import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { money2 } from "@/lib/format";
import { Prisma } from "@prisma/client";
import { AddPayrollButton } from "@/components/AddPayrollButton";

export default async function PayrollPage() {
  await requireAccessPage("payroll");

  const [entries, properties] = await Promise.all([
    db.payrollEntry.findMany({ include: { property: true }, orderBy: { date: "desc" } }),
    db.property.findMany({ select: { id: true, address: true }, orderBy: { address: "asc" } }),
  ]);

  const byWorker = new Map<string, Prisma.Decimal>();
  for (const e of entries) {
    byWorker.set(e.worker, (byWorker.get(e.worker) ?? new Prisma.Decimal(0)).plus(e.hours.times(e.rate)));
  }

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Ledger</div>
          <h2>Payroll Log</h2>
          <div className="fd-sub">Sums post to each property as the Labor (Payroll) rehab line.</div>
        </div>
        <AddPayrollButton properties={properties} />
      </header>

      <div className="fd-card" style={{ marginBottom: 22 }}>
        <div className="fd-card-h">
          <h3>Per-Worker Rollup</h3>
        </div>
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Worker</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...byWorker.entries()].map(([worker, total]) => (
                <tr key={worker}>
                  <td>{worker}</td>
                  <td className="num">{money2(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fd-card">
        <div className="fd-card-h">
          <h3>Entries</h3>
        </div>
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Date</th>
                <th>Property</th>
                <th>Worker</th>
                <th className="num">Hours</th>
                <th className="num">Rate</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No payroll entries yet.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.date.toISOString().slice(0, 10)}</td>
                  <td>{e.property.address}</td>
                  <td>{e.worker}</td>
                  <td className="num">{e.hours.toString()}</td>
                  <td className="num">{money2(e.rate)}</td>
                  <td className="num">{money2(e.hours.times(e.rate))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
