"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  accounts: { id: string; name: string }[];
}

export function AddBankTxnButton({ accounts }: Props) {
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
          accountId: formData.get("accountId"),
          direction: formData.get("direction"),
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
      <button className="fd-btn ghost sm" onClick={() => setOpen(true)} disabled={accounts.length === 0}>
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
            <div className="fld-row">
              <div className="fld">
                <label>Account</label>
                <select name="accountId" required defaultValue={accounts[0]?.id ?? ""}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label>Direction</label>
                <select name="direction" defaultValue="OUT">
                  <option value="OUT">Money Out</option>
                  <option value="IN">Money In</option>
                </select>
              </div>
            </div>
            <p className="hint">
              Enter the amount as a positive number — the direction carries the sign. Money out posts to an
              expense, money in posts to property income.
            </p>
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
