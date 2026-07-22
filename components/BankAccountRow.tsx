"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";

interface Props {
  account: {
    id: string;
    name: string;
    openingBalance: string;
    moneyIn: string;
    moneyOut: string;
    balance: string;
    txnCount: number;
  };
}

// Balance is derived and therefore read-only — only the opening balance is
// editable, so the displayed figure can never drift from the transactions.
export function BankAccountRow({ account }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(account.name);
  const [openingBalance, setOpeningBalance] = useState(account.openingBalance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bank-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, openingBalance }),
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
      const res = await fetch(`/api/bank-accounts/${account.id}`, { method: "DELETE" });
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
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            style={{ width: 110, textAlign: "right" }}
          />
        </td>
        <td className="num">{money2(Number(account.moneyIn))}</td>
        <td className="num">{money2(Number(account.moneyOut))}</td>
        <td className="num">{money2(Number(account.balance))}</td>
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
          {account.txnCount} transaction{account.txnCount === 1 ? "" : "s"}
        </span>
      </td>
      <td className="num">{money2(Number(account.openingBalance))}</td>
      <td className="num pos">{money2(Number(account.moneyIn))}</td>
      <td className="num neg">{money2(Number(account.moneyOut))}</td>
      <td className={`num ${Number(account.balance) >= 0 ? "pos" : "neg"}`}>
        <strong>{money2(Number(account.balance))}</strong>
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
        {error && <div className="err">{error}</div>}

        {confirming && (
          <div className="fd-mask" onClick={() => !busy && setConfirming(false)}>
            <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
              <div className="fd-modal-h">
                <h3>Delete {account.name}?</h3>
              </div>
              <div className="fd-modal-b">
                {account.txnCount > 0 ? (
                  <p className="err">
                    This account has {account.txnCount} transaction{account.txnCount === 1 ? "" : "s"} — delete or
                    move those first.
                  </p>
                ) : (
                  <p>Removes this account from cash on hand.</p>
                )}
                {error && <p className="err">{error}</p>}
              </div>
              <div className="fd-modal-f">
                <button className="fd-btn ghost" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </button>
                <button
                  className="fd-btn"
                  onClick={remove}
                  disabled={busy || account.txnCount > 0}
                  style={{ background: "var(--neg)" }}
                >
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
