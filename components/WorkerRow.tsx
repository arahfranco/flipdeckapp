"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";

interface Props {
  worker: { id: string; name: string; defaultRate: string | null };
}

export function WorkerRow({ worker }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(worker.name);
  const [defaultRate, setDefaultRate] = useState(worker.defaultRate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workers/${worker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, defaultRate }),
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
      const res = await fetch(`/api/workers/${worker.id}`, { method: "DELETE" });
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
        <td className="num">
          <input
            type="number"
            step="0.01"
            min="0"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            style={{ width: 100, textAlign: "right" }}
            placeholder="—"
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
      <td>{worker.name}</td>
      <td className="num">{worker.defaultRate ? `${money2(Number(worker.defaultRate))}/hr` : "—"}</td>
      <td>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="fd-btn ghost sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="fd-btn ghost sm" onClick={() => setConfirming(true)}>
            Delete
          </button>
        </div>
        {error && !editing && <div className="err">{error}</div>}

        {confirming && (
          <div className="fd-mask" onClick={() => !busy && setConfirming(false)}>
            <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
              <div className="fd-modal-h">
                <h3>Delete {worker.name}?</h3>
              </div>
              <div className="fd-modal-b">
                <p>This is blocked if they have any payroll entries on record.</p>
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
