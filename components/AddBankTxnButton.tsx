"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddBankTxnButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formData.get("date"),
          description: formData.get("description"),
          account: formData.get("account"),
          amount: Number(formData.get("amount")),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not add transaction");
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
      <button className="fd-btn ghost sm" onClick={() => setOpen(true)}>
        + Add Transaction
      </button>
    );
  }

  return (
    <div className="fd-mask" onClick={() => !busy && setOpen(false)}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-h">
          <h3>Add Bank Transaction</h3>
        </div>
        <form action={submit}>
          <div className="fd-modal-b">
            <div className="fld-row">
              <div className="fld">
                <label>Date</label>
                <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="fld">
                <label>Amount</label>
                <input type="number" name="amount" step="0.01" min="0" required />
              </div>
            </div>
            <div className="fld">
              <label>Description</label>
              <input type="text" name="description" required />
            </div>
            <div className="fld">
              <label>Account</label>
              <input type="text" name="account" required placeholder="Chase •4471" />
            </div>
            {error && <p className="err">{error}</p>}
          </div>
          <div className="fd-modal-f">
            <button type="button" className="fd-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="fd-btn" disabled={busy}>
              {busy ? "Adding…" : "Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
