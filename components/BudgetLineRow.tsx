"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";

interface Props {
  id: string;
  subcategory: string;
  estimated: string;
  actual: string;
  derived?: boolean;
  actualIsOverridden: boolean;
}

export function BudgetLineRow({ id, subcategory, estimated, actual, derived, actualIsOverridden }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [estValue, setEstValue] = useState(estimated);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/budget/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimated: Number(estValue) }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        {subcategory}
        {derived && (
          <span className="pill p-loan" style={{ marginLeft: 6 }}>
            derived
          </span>
        )}
      </td>
      <td className="num">
        {derived ? (
          money2(Number(estimated))
        ) : editing ? (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <input
              type="number"
              step="0.01"
              value={estValue}
              onChange={(e) => setEstValue(e.target.value)}
              style={{ width: 100, textAlign: "right" }}
              autoFocus
            />
            <button className="fd-btn sm" onClick={save} disabled={busy}>
              {busy ? "…" : "Save"}
            </button>
          </div>
        ) : (
          <button className="linkish" onClick={() => setEditing(true)} style={{ marginLeft: "auto" }}>
            {money2(Number(estimated))}
          </button>
        )}
      </td>
      <td className="num">
        {money2(Number(actual))}
        {actualIsOverridden && (
          <span className="hint" style={{ display: "block", fontSize: 10 }}>
            from expense log
          </span>
        )}
      </td>
    </tr>
  );
}
