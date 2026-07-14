"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";

interface BankRowProps {
  txn: {
    id: string;
    date: string;
    description: string;
    account: string;
    amount: string;
    propertyId: string | null;
    propertyAddress: string | null;
    subcategory: string | null;
    reconciled: boolean;
  };
  properties: { id: string; address: string }[];
  subcategories: string[];
}

export function BankRow({ txn, properties, subcategories }: BankRowProps) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(txn.propertyId ?? "");
  const [subcategory, setSubcategory] = useState(txn.subcategory ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function post() {
    if (!propertyId || !subcategory) {
      setError("Pick a property and subcategory first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bank/${txn.id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, subcategory }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Post failed");
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

  return (
    <tr className={`recon-row${txn.reconciled ? " done" : ""}`}>
      <td>{txn.date}</td>
      <td>{txn.description}</td>
      <td>{txn.account}</td>
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
          txn.subcategory
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
      <td className="num">{money2(Number(txn.amount))}</td>
      <td>
        <div style={{ display: "flex", gap: 6 }}>
          {!txn.reconciled && (
            <button className="fd-btn sm" onClick={post} disabled={busy}>
              Post
            </button>
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
                    This transaction is posted — deleting it will also delete the expense it created (
                    {money2(Number(txn.amount))} at {txn.propertyAddress}, {txn.subcategory}).
                  </p>
                ) : (
                  <p>Delete the {txn.date} transaction &quot;{txn.description}&quot; ({money2(Number(txn.amount))})?</p>
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
