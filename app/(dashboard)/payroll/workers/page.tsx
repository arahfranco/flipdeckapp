import Link from "next/link";
import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { WorkerRow } from "@/components/WorkerRow";
import { AddWorkerButton } from "@/components/AddWorkerButton";

export default async function WorkersPage() {
  await requireAccessPage("payroll");

  const workers = await db.worker.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">
            <Link href="/payroll">Payroll</Link>
          </div>
          <h2>Workers</h2>
          <div className="fd-sub">Used when logging payroll entries.</div>
        </div>
        <AddWorkerButton />
      </header>

      <div className="fd-card">
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Default Rate</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workers.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">
                    No workers yet.
                  </td>
                </tr>
              )}
              {workers.map((w) => (
                <WorkerRow key={w.id} worker={{ id: w.id, name: w.name, defaultRate: w.defaultRate?.toString() ?? null }} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
