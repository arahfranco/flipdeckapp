"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";

interface Props {
  entry: {
    id: string;
    date: string;
    propertyId: string;
    propertyAddress: string;
    workerId: string;
    workerName: string;
    hours: string;
    rate: string;
    notes: string | null;
  };
  properties: { id: string; address: string }[];
  workers: { id: string; name: string }[];
}

export function PayrollRow({ entry, properties, workers }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [date, setDate] = useState(entry.date);
  const [propertyId, setPropertyId] = useState(entry.propertyId);
  const [workerId, setWorkerId] = useState(entry.workerId);
  const [hours, setHours] = useState(entry.hours);
  const [rate, setRate] = useState(entry.rate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, propertyId, workerId, hours: Number(hours), rate: Number(rate) }),
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
      const res = await fetch(`/api/payroll/${entry.id}`, { method: "DELETE" });
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
          <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="sel-inline">
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </td>
        <td className="num">
          <input
            type="number"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            style={{ width: 70, textAlign: "right" }}
          />
        </td>
        <td className="num">
          <input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            style={{ width: 80, textAlign: "right" }}
          />
        </td>
        <td className="num">{money2(Number(hours || 0) * Number(rate || 0))}</td>
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
      <td>{entry.date}</td>
      <td>{entry.propertyAddress}</td>
      <td>{entry.workerName}</td>
      <td className="num">{entry.hours}</td>
      <td className="num">{money2(Number(entry.rate))}</td>
      <td className="num">{money2(Number(entry.hours) * Number(entry.rate))}</td>
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
                <h3>Delete this payroll entry?</h3>
              </div>
              <div className="fd-modal-b">
                <p>
                  {entry.workerName} — {entry.hours} hrs at {entry.propertyAddress} on {entry.date}
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
