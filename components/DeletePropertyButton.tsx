"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";

interface Impact {
  budgetLines: number;
  expenses: { count: number; total: string };
  payroll: { count: number; total: string };
  contributions: { count: number; total: string };
  bankTxnsToUnassign: number;
}

export function DeletePropertyButton({ propertyId, address }: { propertyId: string; address: string }) {
  const router = useRouter();
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/delete-impact`);
      if (!res.ok) throw new Error("Could not load delete impact");
      setImpact(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/properties");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setDeleting(false);
    }
  }

  return (
    <>
      <button className="fd-btn ghost sm" onClick={openConfirm} disabled={loading}>
        {loading ? "Loading…" : "Delete Property"}
      </button>

      {impact && (
        <div className="fd-mask" onClick={() => !deleting && setImpact(null)}>
          <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fd-modal-h">
              <h3>Delete {address}?</h3>
            </div>
            <div className="fd-modal-b">
              <p style={{ marginBottom: 12 }}>This permanently destroys:</p>
              <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
                <li>{impact.budgetLines} budget line{impact.budgetLines === 1 ? "" : "s"}</li>
                <li>
                  {impact.expenses.count} expense{impact.expenses.count === 1 ? "" : "s"} (
                  {money2(Number(impact.expenses.total))})
                </li>
                <li>
                  {impact.payroll.count} payroll entr{impact.payroll.count === 1 ? "y" : "ies"} (
                  {money2(Number(impact.payroll.total))})
                </li>
                <li>
                  {impact.contributions.count} capital contribution{impact.contributions.count === 1 ? "" : "s"} (
                  {money2(Number(impact.contributions.total))})
                </li>
              </ul>
              {impact.bankTxnsToUnassign > 0 && (
                <p className="hint" style={{ marginTop: 12 }}>
                  {impact.bankTxnsToUnassign} bank transaction{impact.bankTxnsToUnassign === 1 ? "" : "s"} will be
                  un-assigned and returned to the review queue — not deleted. The money genuinely left the account.
                </p>
              )}
              {error && <p className="err">{error}</p>}
            </div>
            <div className="fd-modal-f">
              <button className="fd-btn ghost" onClick={() => setImpact(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="fd-btn" onClick={confirmDelete} disabled={deleting} style={{ background: "var(--neg)" }}>
                {deleting ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
