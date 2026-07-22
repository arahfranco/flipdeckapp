"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  partners: { id: string; name: string }[];
  properties: { id: string; address: string }[];
  /** Set when opened from a property page — hides the picker and pins the entry to it. */
  lockedPropertyId?: string;
}

export function AddContributionButton({ partners, properties, lockedPropertyId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: formData.get("partnerId"),
          propertyId: formData.get("propertyId"),
          date: formData.get("date"),
          kind: formData.get("kind"),
          amount: Number(formData.get("amount")),
          description: formData.get("description"),
        }),
      });
      if (!res.ok) throw new Error("Could not add contribution");
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
        + Add Contribution
      </button>
    );
  }

  return (
    <div className="fd-mask" onClick={() => !busy && setOpen(false)}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-h">
          <h3>Add Contribution</h3>
        </div>
        <form action={submit}>
          <div className="fd-modal-b">
            <div className="fld-row">
              <div className="fld">
                <label>Partner</label>
                <select name="partnerId" required>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {lockedPropertyId ? (
                // Hidden inputs don't render, so Partner takes the full row.
                <input type="hidden" name="propertyId" value={lockedPropertyId} />
              ) : (
                <div className="fld">
                  <label>Property</label>
                  <select name="propertyId" required>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.address}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Date</label>
                <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="fld">
                <label>Kind</label>
                <select name="kind" required>
                  <option value="EQUITY">Equity</option>
                  <option value="LOAN">Loan</option>
                  <option value="DRAW">Draw</option>
                </select>
              </div>
            </div>
            <div className="fld">
              <label>Amount</label>
              <input type="number" name="amount" step="0.01" min="0" required />
            </div>
            <div className="fld">
              <label>Description</label>
              <input type="text" name="description" />
            </div>
            {error && <p className="err">{error}</p>}
          </div>
          <div className="fd-modal-f">
            <button type="button" className="fd-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="fd-btn" disabled={busy}>
              {busy ? "Saving…" : "Add Contribution"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
