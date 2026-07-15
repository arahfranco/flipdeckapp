"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ContribKind } from "@prisma/client";
import { money2 } from "@/lib/format";

interface Props {
  contribution: {
    id: string;
    date: string;
    partnerId: string;
    partnerName: string;
    propertyId: string;
    propertyAddress: string;
    kind: ContribKind;
    description: string | null;
    amount: string;
  };
  partners: { id: string; name: string }[];
  properties: { id: string; address: string }[];
}

export function ContributionRow({ contribution, partners, properties }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [date, setDate] = useState(contribution.date);
  const [partnerId, setPartnerId] = useState(contribution.partnerId);
  const [propertyId, setPropertyId] = useState(contribution.propertyId);
  const [kind, setKind] = useState<ContribKind>(contribution.kind);
  const [description, setDescription] = useState(contribution.description ?? "");
  const [amount, setAmount] = useState(contribution.amount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contributions/${contribution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, partnerId, propertyId, kind, description, amount: Number(amount) }),
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
      const res = await fetch(`/api/contributions/${contribution.id}`, { method: "DELETE" });
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
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="sel-inline">
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
          <select value={kind} onChange={(e) => setKind(e.target.value as ContribKind)} className="sel-inline">
            {Object.values(ContribKind).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
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
      <td>{contribution.date}</td>
      <td>{contribution.partnerName}</td>
      <td>{contribution.propertyAddress}</td>
      <td>
        <span className={`pill p-${contribution.kind.toLowerCase()}`}>{contribution.kind}</span>
      </td>
      <td>{contribution.description}</td>
      <td className={`num ${contribution.kind === "DRAW" ? "neg" : ""}`}>
        {contribution.kind === "DRAW" ? "−" : ""}
        {money2(Number(contribution.amount))}
      </td>
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
                <h3>Delete this contribution?</h3>
              </div>
              <div className="fd-modal-b">
                <p>
                  {contribution.partnerName} — {contribution.kind} of {money2(Number(contribution.amount))} at{" "}
                  {contribution.propertyAddress}
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
