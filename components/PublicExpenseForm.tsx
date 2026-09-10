"use client";

import { useState } from "react";
import { FileUploadField } from "./FileUploadField";

interface Props {
  token: string;
  properties: { id: string; address: string }[];
  subcategories: string[];
}

const today = () => new Date().toISOString().slice(0, 10);

export function PublicExpenseForm({ token, properties, subcategories }: Props) {
  const [propertyId, setPropertyId] = useState("");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [subcategory, setSubcategory] = useState(subcategories[0] ?? "");
  const [status, setStatus] = useState("PENDING");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  // Bump to remount the file field so its internal state clears between entries.
  const [uploadKey, setUploadKey] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/entry/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, date, amount: Number(amount), description, subcategory, status, receiptUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not submit");
      // Keep property / date / category for fast repeat entry; clear the rest.
      setAmount("");
      setDescription("");
      setReceiptUrl(null);
      setStatus("PENDING");
      setUploadKey((k) => k + 1);
      setSavedCount((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {savedCount > 0 && (
        <div className="ok" style={{ marginBottom: 14 }}>
          ✓ Saved. {savedCount} expense{savedCount === 1 ? "" : "s"} submitted — add another below.
        </div>
      )}

      <div className="fld">
        <label>Property</label>
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">— General / overhead (no property) —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}
            </option>
          ))}
        </select>
      </div>

      <div className="fld">
        <label>Amount</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          placeholder="0.00"
        />
      </div>

      <div className="fld">
        <label>What was it for?</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lumber at Home Depot" required />
      </div>

      <div className="fld">
        <label>Category</label>
        <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} required>
          {subcategories.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="fld">
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="fld">
        <label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="REIMBURSED">Reimbursed</option>
        </select>
      </div>

      <FileUploadField
        key={uploadKey}
        kind="receipt"
        value={receiptUrl}
        onUploaded={setReceiptUrl}
        uploadUrl={`/api/entry/${token}/upload`}
        label="Receipt photo (optional)"
      />

      {error && <p className="err">{error}</p>}

      <button type="submit" className="fd-btn" disabled={busy} style={{ width: "100%", marginTop: 8, padding: "12px" }}>
        {busy ? "Submitting…" : "Submit expense"}
      </button>
    </form>
  );
}
