"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddPayrollButton({ properties }: { properties: { id: string; address: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: formData.get("propertyId"),
          date: formData.get("date"),
          worker: formData.get("worker"),
          hours: Number(formData.get("hours")),
          rate: Number(formData.get("rate")),
          notes: formData.get("notes"),
        }),
      });
      if (!res.ok) throw new Error("Could not add payroll entry");
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
        + Add Payroll Entry
      </button>
    );
  }

  return (
    <div className="fd-mask" onClick={() => !busy && setOpen(false)}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-h">
          <h3>Add Payroll Entry</h3>
        </div>
        <form action={submit}>
          <div className="fd-modal-b">
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
            <div className="fld-row">
              <div className="fld">
                <label>Date</label>
                <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="fld">
                <label>Worker</label>
                <input type="text" name="worker" required />
              </div>
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Hours</label>
                <input type="number" name="hours" step="0.25" min="0" required />
              </div>
              <div className="fld">
                <label>Rate ($/hr)</label>
                <input type="number" name="rate" step="0.01" min="0" required />
              </div>
            </div>
            <div className="fld">
              <label>Notes</label>
              <input type="text" name="notes" />
            </div>
            {error && <p className="err">{error}</p>}
          </div>
          <div className="fd-modal-f">
            <button type="button" className="fd-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="fd-btn" disabled={busy}>
              {busy ? "Saving…" : "Add Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
