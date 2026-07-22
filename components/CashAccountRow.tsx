"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";

interface Props {
  account: { id: string; name: string; balance: string; notes: string | null; updatedAt: string };
}

export function CashAccountRow({ account }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState(account.balance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cash-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, balance: Number(balance) }),
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
      const res = await fetch(`/api/cash-accounts/${account.id}`, { method: "DELETE" });
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
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            style={{ width: 120, textAlign: "right" }}
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
      <td>
        {account.name}
        <span className="hint" style={{ display: "block", fontSize: 10 }}>
          updated {account.updatedAt}
        </span>
      </td>
      <td className="num">{money2(Number(account.balance))}</td>
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
                <h3>Delete {account.name}?</h3>
              </div>
              <div className="fd-modal-b">
                <p>
                  Removes this account and its {money2(Number(account.balance))} balance from cash on hand.
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
