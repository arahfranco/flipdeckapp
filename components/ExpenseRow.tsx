"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExpenseStatus } from "@prisma/client";
import { money2 } from "@/lib/format";
import { ALL_SUBS, EXPENSE_STATUS_LABELS } from "@/lib/constants";

interface Props {
  expense: {
    id: string;
    date: string;
    propertyId: string;
    propertyAddress: string;
    description: string;
    subcategory: string;
    status: ExpenseStatus;
    amount: string;
  };
  properties: { id: string; address: string }[];
}

export function ExpenseRow({ expense, properties }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [date, setDate] = useState(expense.date);
  const [propertyId, setPropertyId] = useState(expense.propertyId);
  const [description, setDescription] = useState(expense.description);
  const [subcategory, setSubcategory] = useState(expense.subcategory);
  const [status, setStatus] = useState<ExpenseStatus>(expense.status);
  const [amount, setAmount] = useState(expense.amount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subcategories = ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, propertyId, description, subcategory, status, amount: Number(amount) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ minWidth: 130 }} />
        </td>
        <td>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="sel-inline">
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        </td>
        <td>
          <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="sel-inline">
            {subcategories.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </td>
        <td>
          <select value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)} className="sel-inline">
            {Object.values(ExpenseStatus).map((s) => (
              <option key={s} value={s}>
                {EXPENSE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </td>
        <td className="num">
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 100, textAlign: "right" }}
          />
        </td>
        <td>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="fd-btn sm" onClick={save} disabled={busy}>
              {busy ? "…" : "Save"}
            </button>
            <button className="fd-btn ghost sm" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </button>
          </div>
          {error && <div className="err">{error}</div>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{expense.date}</td>
      <td>{expense.propertyAddress}</td>
      <td>{expense.description}</td>
      <td>{expense.subcategory}</td>
      <td>
        <span className={`pill p-${expense.status.toLowerCase()}`}>{EXPENSE_STATUS_LABELS[expense.status]}</span>
      </td>
      <td className="num">{money2(Number(expense.amount))}</td>
      <td>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="fd-btn ghost sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="fd-btn ghost sm" onClick={() => setConfirming(true)}>
            Delete
          </button>
        </div>

        {confirming && (
          <div className="fd-mask" onClick={() => !busy && setConfirming(false)}>
            <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
              <div className="fd-modal-h">
                <h3>Delete this expense?</h3>
              </div>
              <div className="fd-modal-b">
                <p>
                  {expense.description} — {money2(Number(expense.amount))} at {expense.propertyAddress}
                </p>
                <p className="hint">
                  If this was created by posting a bank transaction, the bank row stays but returns to unposted.
                </p>
                {error && <p className="err">{error}</p>}
              </div>
              <div className="fd-modal-f">
                <button className="fd-btn ghost" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="fd-btn" onClick={remove} disabled={busy} style={{ background: "var(--neg)" }}>
                  {busy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
