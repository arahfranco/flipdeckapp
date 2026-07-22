"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LiabilityKind } from "@prisma/client";
import { LIABILITY_KIND_LABELS } from "@/lib/constants";

export function AddLiabilityButton({ properties }: { properties: { id: string; address: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/liabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          kind: formData.get("kind"),
          balance: Number(formData.get("balance")),
          interestRate: formData.get("interestRate"),
          propertyId: formData.get("propertyId") || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not add debt");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="fd-btn sm" onClick={() => setOpen(true)}>
        + Debt
      </button>
    );
  }

  return (
    <div className="fd-mask" onClick={() => !busy && setOpen(false)}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-h">
          <h3>Add Debt</h3>
        </div>
        <form action={submit}>
          <div className="fd-modal-b">
            <div className="fld">
              <label>Lender</label>
              <input type="text" name="name" required placeholder="Anchor Capital" />
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Type</label>
                <select name="kind" defaultValue={LiabilityKind.HARD_MONEY}>
                  {Object.values(LiabilityKind).map((k) => (
                    <option key={k} value={k}>
                      {LIABILITY_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label>Interest Rate (%)</label>
                <input type="number" name="interestRate" step="0.001" placeholder="9.5" />
              </div>
            </div>
            <div className="fld">
              <label>Current Balance</label>
              <input type="number" name="balance" step="0.01" min="0" required />
            </div>
            <div className="fld">
              <label>Property</label>
              <select name="propertyId" defaultValue="">
                <option value="">— Company-level (not tied to a property) —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address}
                  </option>
                ))}
              </select>
            </div>
            <p className="hint">
              For outside debt only. Partner-funded loans are already counted from the Capital ledger — adding
              them here too would double-count.
            </p>
            {error && <p className="err">{error}</p>}
          </div>
          <div className="fd-modal-f">
            <button type="button" className="fd-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="fd-btn" disabled={busy}>
              {busy ? "Adding…" : "Add Debt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
