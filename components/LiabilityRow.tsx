"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LiabilityKind } from "@prisma/client";
import { money2 } from "@/lib/format";
import { LIABILITY_KIND_LABELS } from "@/lib/constants";

interface Props {
  liability: {
    id: string;
    name: string;
    kind: LiabilityKind;
    balance: string;
    interestRate: string | null;
    propertyId: string | null;
    propertyAddress: string | null;
  };
  properties: { id: string; address: string }[];
}

export function LiabilityRow({ liability, properties }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(liability.name);
  const [kind, setKind] = useState<LiabilityKind>(liability.kind);
  const [balance, setBalance] = useState(liability.balance);
  const [interestRate, setInterestRate] = useState(liability.interestRate ?? "");
  const [propertyId, setPropertyId] = useState(liability.propertyId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/liabilities/${liability.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, balance: Number(balance), interestRate, propertyId: propertyId || null }),
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
      const res = await fetch(`/api/liabilities/${liability.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not delete");
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
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td>
          <select value={kind} onChange={(e) => setKind(e.target.value as LiabilityKind)} className="sel-inline">
            {Object.values(LiabilityKind).map((k) => (
              <option key={k} value={k}>
                {LIABILITY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </td>
        <td>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="sel-inline">
            <option value="">— Company-level —</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </select>
        </td>
        <td className="num">
          <input
            type="number"
            step="0.001"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            style={{ width: 70, textAlign: "right" }}
          />
        </td>
        <td className="num">
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            style={{ width: 110, textAlign: "right" }}
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
      <td>{liability.name}</td>
      <td>
        <span className="pill p-loan">{LIABILITY_KIND_LABELS[liability.kind]}</span>
      </td>
      <td>{liability.propertyAddress ?? <span className="hint">Company-level</span>}</td>
      <td className="num">{liability.interestRate ? `${liability.interestRate}%` : "—"}</td>
      <td className="num">{money2(Number(liability.balance))}</td>
      <td>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="fd-btn ghost sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="fd-btn ghost sm" onClick={() => setConfirming(true)}>
            Delete
          </button>
        </div>
        {error && <div className="err">{error}</div>}

        {confirming && (
          <div className="fd-mask" onClick={() => !busy && setConfirming(false)}>
            <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
              <div className="fd-modal-h">
                <h3>Delete {liability.name}?</h3>
              </div>
              <div className="fd-modal-b">
                <p>
                  Removes this {money2(Number(liability.balance))} debt from the balance sheet — company equity
                  will rise by that amount. Only do this once the debt is genuinely paid off.
                </p>
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
