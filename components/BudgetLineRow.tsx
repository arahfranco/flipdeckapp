"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";

interface Props {
  id: string;
  subcategory: string;
  category: string;
  estimated: string;
  actual: string;
  derived?: boolean;
  actualIsOverridden: boolean;
}

// "Actual" is a pure derived value for every cost line — the expense-log sum
// for that subcategory, or $0 if nothing's been logged (spec §2, rule 2).
// The one exception is the Sale Price line: it's revenue, not a cost, so it
// has no expense-log equivalent — its stored value is how a property gets
// marked "sold" at all (the profit-basis switch depends on it), so it stays
// directly editable.
export function BudgetLineRow({ id, subcategory, category, estimated, actual, derived, actualIsOverridden }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [estValue, setEstValue] = useState(estimated);
  const [actValue, setActValue] = useState(actual);
  const [busy, setBusy] = useState(false);
  const actualEditable = category === "Selling Price";

  async function save() {
    setBusy(true);
    try {
      const data: Record<string, number> = { estimated: Number(estValue) };
      if (actualEditable) data.actual = Number(actValue);
      const res = await fetch(`/api/budget/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
          <input
            type="number"
            step="0.01"
            value={estValue}
            onChange={(e) => setEstValue(e.target.value)}
            style={{ width: 100, textAlign: "right" }}
            autoFocus
          />
        ) : (
          <button className="linkish" onClick={() => setEditing(true)} style={{ marginLeft: "auto" }}>
            {money2(Number(estimated))}
          </button>
        )}
      </td>
      <td className="num">
        {editing ? (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
            {actualEditable ? (
              <input
                type="number"
                step="0.01"
                value={actValue}
                onChange={(e) => setActValue(e.target.value)}
                style={{ width: 90, textAlign: "right" }}
              />
            ) : (
              <span>{money2(Number(actual))}</span>
            )}
            <button className="fd-btn sm" onClick={save} disabled={busy}>
              {busy ? "…" : "Save"}
            </button>
            <button className="fd-btn ghost sm" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        ) : actualEditable ? (
          <button className="linkish" onClick={() => setEditing(true)} style={{ marginLeft: "auto" }}>
            {money2(Number(actual))}
          </button>
        ) : (
          money2(Number(actual))
        )}
        {actualIsOverridden && (
          <span className="hint" style={{ display: "block", fontSize: 10 }}>
            from expense log
          </span>
        )}
      </td>
    </tr>
  );
}
