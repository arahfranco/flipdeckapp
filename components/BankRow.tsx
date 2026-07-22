"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IncomeCategory, TxnDirection } from "@prisma/client";
import { money2 } from "@/lib/format";
import { INCOME_CATEGORY_LABELS } from "@/lib/constants";

interface BankRowProps {
  txn: {
    id: string;
    date: string;
    description: string;
    accountId: string;
    accountName: string;
    amount: string;
    direction: TxnDirection;
    propertyId: string | null;
    propertyAddress: string | null;
    subcategory: string | null;
    reconciled: boolean;
  };
  properties: { id: string; address: string }[];
  accounts: { id: string; name: string }[];
  subcategories: string[];
}

export function BankRow({ txn, properties, accounts, subcategories }: BankRowProps) {
  const router = useRouter();
  const isIn = txn.direction === TxnDirection.IN;

  const [propertyId, setPropertyId] = useState(txn.propertyId ?? "");
  const [subcategory, setSubcategory] = useState(txn.subcategory ?? "");
  const [category, setCategory] = useState<IncomeCategory>(IncomeCategory.RENT);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(txn.date);
  const [description, setDescription] = useState(txn.description);
  const [accountId, setAccountId] = useState(txn.accountId);
  const [direction, setDirection] = useState<TxnDirection>(txn.direction);
  const [amount, setAmount] = useState(txn.amount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function post() {
    // Money out needs a budget subcategory; money in needs an income category.
    if (!propertyId || (!isIn && !subcategory)) {
      setError(isIn ? "Pick a property first" : "Pick a property and subcategory first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bank/${txn.id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isIn ? { propertyId, category } : { propertyId, subcategory }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Post failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bank/${txn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, description, accountId, direction, amount: Number(amount) }),
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
    setConfirming(false);
    try {
      const res = await fetch(`/api/bank/${txn.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="recon-row">
        <td>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ minWidth: 130 }} />
        </td>
        <td>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        </td>
        <td>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="sel-inline">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </td>
        <td>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as TxnDirection)}
            className="sel-inline"
          >
            <option value={TxnDirection.OUT}>Money Out</option>
            <option value={TxnDirection.IN}>Money In</option>
          </select>
        </td>
        <td colSpan={2} className="hint">
          Assign after saving
        </td>
        <td className="num">
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 90, textAlign: "right" }}
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
    <tr className={`recon-row${txn.reconciled ? " done" : ""}`}>
      <td>{txn.date}</td>
      <td>{txn.description}</td>
      <td>{txn.accountName}</td>
      <td>
        <span className={`pill ${isIn ? "p-equity" : "p-draw"}`}>{isIn ? "In" : "Out"}</span>
      </td>
      <td>
        {txn.reconciled ? (
          txn.propertyAddress
        ) : (
          <select className="sel-inline" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Choose…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </select>
        )}
      </td>
      <td>
        {txn.reconciled ? (
          isIn ? (
            <span className="hint">income</span>
          ) : (
            txn.subcategory
          )
        ) : isIn ? (
          <select
            className="sel-inline"
            value={category}
            onChange={(e) => setCategory(e.target.value as IncomeCategory)}
          >
            {Object.values(IncomeCategory).map((c) => (
              <option key={c} value={c}>
                {INCOME_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        ) : (
          <select className="sel-inline" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            <option value="">Choose…</option>
            {subcategories.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className={`num ${isIn ? "pos" : ""}`}>
        {isIn ? "+" : "−"}
        {money2(Number(txn.amount))}
      </td>
      <td>
        <div style={{ display: "flex", gap: 6 }}>
          {!txn.reconciled && (
            <>
              <button className="fd-btn sm" onClick={post} disabled={busy}>
                Post
              </button>
              <button className="fd-btn ghost sm" onClick={() => setEditing(true)} disabled={busy}>
                Edit
              </button>
            </>
          )}
          <button className="fd-btn ghost sm" onClick={() => setConfirming(true)} disabled={busy}>
            Delete
          </button>
        </div>
        {error && <div className="err">{error}</div>}

        {confirming && (
          <div className="fd-mask" onClick={() => !busy && setConfirming(false)}>
            <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
              <div className="fd-modal-h">
                <h3>Delete this transaction?</h3>
              </div>
              <div className="fd-modal-b">
                {txn.reconciled ? (
                  <p>
                    This transaction is posted — deleting it will also delete the{" "}
                    {isIn ? "income" : "expense"} it created ({money2(Number(txn.amount))} at{" "}
                    {txn.propertyAddress}).
                  </p>
                ) : (
                  <p>
                    Delete the {txn.date} transaction &quot;{txn.description}&quot; (
                    {money2(Number(txn.amount))})? This changes the derived balance for {txn.accountName}.
                  </p>
                )}
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
