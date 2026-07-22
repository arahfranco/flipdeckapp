"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_SUBS } from "@/lib/constants";
import { FileUploadField } from "./FileUploadField";

interface Props {
  properties: { id: string; address: string }[];
  /** Set when opened from a property page — hides the picker and pins the entry to it. */
  lockedPropertyId?: string;
}

export function AddExpenseButton({ properties, lockedPropertyId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const subcategories = ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: formData.get("propertyId"),
          date: formData.get("date"),
          amount: Number(formData.get("amount")),
          description: formData.get("description"),
          subcategory: formData.get("subcategory"),
          status: formData.get("status"),
          receiptUrl,
        }),
      });
      if (!res.ok) throw new Error("Could not add expense");
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
        + Add Expense
      </button>
    );
  }

  return (
    <div className="fd-mask" onClick={() => !busy && setOpen(false)}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-h">
          <h3>Add Expense</h3>
        </div>
        <form action={submit}>
          <div className="fd-modal-b">
            {lockedPropertyId ? (
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
                <label>Subcategory</label>
                <select name="subcategory" required>
                  {subcategories.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label>Status</label>
                <select name="status" defaultValue="PENDING">
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="REIMBURSED">Reimbursed</option>
                </select>
              </div>
            </div>
            <FileUploadField kind="receipt" value={receiptUrl} onUploaded={setReceiptUrl} label="Receipt (optional)" />
            {error && <p className="err">{error}</p>}
          </div>
          <div className="fd-modal-f">
            <button type="button" className="fd-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="fd-btn" disabled={busy}>
              {busy ? "Saving…" : "Add Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
