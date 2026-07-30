"use client";

import { useMemo, useState } from "react";
import { ExpenseStatus } from "@prisma/client";
import { ExpenseRow } from "./ExpenseRow";

interface ExpenseVM {
  id: string;
  date: string;
  createdAt: string;
  propertyId: string;
  propertyAddress: string;
  description: string;
  subcategory: string;
  status: ExpenseStatus;
  amount: string;
  receiptUrl: string | null;
}

type SortKey =
  | "date" | "createdAt" | "propertyAddress" | "description" | "subcategory" | "status" | "amount" | "receipt";

interface Column {
  key: SortKey;
  label: string;
  /** text sorts A→Z first; numbers, dates and receipt-present sort high→low first */
  numeric?: boolean;
  num?: boolean; // right-aligned cell
}

const COLUMNS: Column[] = [
  { key: "date", label: "Date of Receipt", numeric: true },
  { key: "createdAt", label: "Added", numeric: true },
  { key: "propertyAddress", label: "Property" },
  { key: "description", label: "Description" },
  { key: "subcategory", label: "Subcategory" },
  { key: "status", label: "Status" },
  { key: "amount", label: "Amount", numeric: true, num: true },
  { key: "receipt", label: "Receipt", numeric: true },
];

function compare(a: ExpenseVM, b: ExpenseVM, key: SortKey): number {
  switch (key) {
    case "amount":
      return Number(a.amount) - Number(b.amount);
    case "receipt":
      return (a.receiptUrl ? 1 : 0) - (b.receiptUrl ? 1 : 0);
    case "date":
    case "createdAt":
      return a[key].localeCompare(b[key]); // ISO YYYY-MM-DD sorts chronologically
    default:
      return a[key].localeCompare(b[key]);
  }
}

export function ExpensesTable({
  expenses,
  properties,
}: {
  expenses: ExpenseVM[];
  properties: { id: string; address: string }[];
}) {
  // Default: newest receipt first, matching the previous static order.
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  function clickHeader(col: Column) {
    if (col.key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      // Sensible first direction per type: dates/amounts high→low, text A→Z.
      setDir(col.numeric ? "desc" : "asc");
    }
  }

  const sorted = useMemo(() => {
    const mult = dir === "asc" ? 1 : -1;
    // Stable: fall back to id so equal keys keep a consistent order.
    return [...expenses].sort((a, b) => compare(a, b, sortKey) * mult || a.id.localeCompare(b.id));
  }, [expenses, sortKey, dir]);

  return (
    <div className="fd-tw">
      <table className="fd-t">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = col.key === sortKey;
              return (
                <th key={col.key} className={col.num ? "num" : undefined}>
                  <button
                    type="button"
                    className={`sortbtn${active ? " active" : ""}`}
                    onClick={() => clickHeader(col)}
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    {col.label}
                    <span className="car" aria-hidden="true">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
              );
            })}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={9} className="empty">
                No expenses logged yet.
              </td>
            </tr>
          )}
          {sorted.map((e) => (
            <ExpenseRow key={e.id} expense={e} properties={properties} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
