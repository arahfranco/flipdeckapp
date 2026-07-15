import Link from "next/link";
import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { money2 } from "@/lib/format";
import { Prisma } from "@prisma/client";
import { AddPayrollButton } from "@/components/AddPayrollButton";
import { PayrollRow } from "@/components/PayrollRow";

export default async function PayrollPage() {
  await requireAccessPage("payroll");

  const [entries, properties, workers] = await Promise.all([
    db.payrollEntry.findMany({ include: { property: true, worker: true }, orderBy: { date: "desc" } }),
    db.property.findMany({ select: { id: true, address: true }, orderBy: { address: "asc" } }),
    db.worker.findMany({ orderBy: { name: "asc" } }),
  ]);

  const byWorker = new Map<string, Prisma.Decimal>();
  for (const e of entries) {
    byWorker.set(e.worker.name, (byWorker.get(e.worker.name) ?? new Prisma.Decimal(0)).plus(e.hours.times(e.rate)));
  }

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Ledger</div>
          <h2>Payroll Log</h2>
          <div className="fd-sub">Sums post to each property as the Labor (Payroll) rehab line.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/payroll/workers" className="fd-btn ghost sm">
            Manage Workers
          </Link>
          <AddPayrollButton
            properties={properties}
            workers={workers.map((w) => ({ id: w.id, name: w.name, defaultRate: w.defaultRate?.toString() ?? null }))}
          />
        </div>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No payroll entries yet.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <PayrollRow
                  key={e.id}
                  entry={{
                    id: e.id,
                    date: e.date.toISOString().slice(0, 10),
                    propertyId: e.propertyId,
                    propertyAddress: e.property.address,
                    workerId: e.workerId,
                    workerName: e.worker.name,
                    hours: e.hours.toString(),
                    rate: e.rate.toString(),
                    notes: e.notes,
                  }}
                  properties={properties}
                  workers={workers.map((w) => ({ id: w.id, name: w.name }))}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
