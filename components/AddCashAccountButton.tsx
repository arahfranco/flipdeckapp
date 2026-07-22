"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddCashAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cash-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), balance: Number(formData.get("balance")) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not add account");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="fd-btn ghost sm" onClick={() => setOpen(true)}>
        + Cash Account
      </button>
    );
  }

  return (
    <div className="fd-mask" onClick={() => !busy && setOpen(false)}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-h">
          <h3>Add Cash Account</h3>
        </div>
        <form action={submit}>
          <div className="fd-modal-b">
            <div className="fld">
              <label>Account Name</label>
              <input type="text" name="name" required placeholder="Chase Operating •4471" />
            </div>
            <div className="fld">
              <label>Current Balance</label>
              <input type="number" name="balance" step="0.01" required />
              <p className="hint">
                Balances are maintained by hand — bank transactions only record money out, so cash can&apos;t be
                derived automatically.
              </p>
            </div>
            {error && <p className="err">{error}</p>}
          </div>
          <div className="fd-modal-f">
            <button type="button" className="fd-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="fd-btn" disabled={busy}>
              {busy ? "Adding…" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
