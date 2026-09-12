"use client";

import { useState } from "react";
import type { ExpenseVM } from "./ExpensesTable";

type Format = "csv" | "pdf";
type DateField = "date" | "createdAt";

interface Props {
  expenses: ExpenseVM[];
  /** Branding for the PDF header. */
  title?: string;
}

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportExpensesButton({ expenses, title = "Expenses" }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("csv");
  const [dateField, setDateField] = useState<DateField>("date");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selected(): ExpenseVM[] {
    const rows = expenses.filter((e) => {
      const d = dateField === "date" ? e.date : e.createdAt;
      if (from || to) {
        if (!d) return false; // an undated row can't fall inside a range
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
    // Newest first by the chosen date; undated rows (only possible with no
    // range) sort to the end.
    return rows.sort((a, b) => {
      const da = dateField === "date" ? a.date : a.createdAt;
      const dbv = dateField === "date" ? b.date : b.createdAt;
      return (dbv || "").localeCompare(da || "");
    });
  }

  function rangeLabel(): string {
    if (from && to) return `${from} to ${to}`;
    if (from) return `from ${from}`;
    if (to) return `through ${to}`;
    return "all dates";
  }

  function fileStem(): string {
    const parts = ["expenses"];
    if (from) parts.push(from);
    if (to) parts.push(to);
    if (!from && !to) parts.push(new Date().toISOString().slice(0, 10));
    return parts.join("_");
  }

  const HEADERS = ["Date of Transaction", "Date Added", "Property", "Description", "Subcategory", "Status", "Amount"];

  function rowValues(e: ExpenseVM): string[] {
    return [
      e.date || "—",
      e.createdAt,
      e.propertyAddress ?? "General",
      e.description,
      e.subcategory,
      e.status.charAt(0) + e.status.slice(1).toLowerCase(),
      Number(e.amount).toFixed(2),
    ];
  }

  function exportCsv(rows: ExpenseVM[]) {
    const lines = [HEADERS.join(",")];
    for (const e of rows) lines.push(rowValues(e).map(csvField).join(","));
    const total = rows.reduce((s, e) => s + Number(e.amount), 0);
    lines.push(["", "", "", "", "", "Total", total.toFixed(2)].map(csvField).join(","));
    triggerDownload(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${fileStem()}.csv`);
  }

  async function exportPdf(rows: ExpenseVM[]) {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(15);
    doc.text(`${title} — Expenses`, 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(110);
    const by = dateField === "date" ? "Date of transaction" : "Date added";
    doc.text(`${by}: ${rangeLabel()}   ·   ${rows.length} entr${rows.length === 1 ? "y" : "ies"}   ·   Generated ${new Date().toISOString().slice(0, 10)}`, 14, 22);

    const total = rows.reduce((s, e) => s + Number(e.amount), 0);
    autoTable(doc, {
      startY: 26,
      head: [HEADERS],
      body: rows.map((e) => {
        const v = rowValues(e);
        v[6] = money(Number(e.amount)); // pretty amount in the PDF
        return v;
      }),
      foot: [["", "", "", "", "", "Total", money(total)]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [63, 107, 94] }, // --green
      footStyles: { fillColor: [237, 234, 226], textColor: 20, fontStyle: "bold" },
      columnStyles: { 6: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    doc.save(`${fileStem()}.pdf`);
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const rows = selected();
      if (rows.length === 0) {
        setError("No expenses match that date range.");
        return;
      }
      if (format === "csv") exportCsv(rows);
      else await exportPdf(rows);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="fd-btn ghost sm" onClick={() => setOpen(true)}>
        ↓ Export
      </button>
    );
  }

  const count = selected().length;

  return (
    <div className="fd-mask" onClick={() => !busy && setOpen(false)}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="fd-modal-h">
          <h3>Export expenses</h3>
        </div>
        <div className="fd-modal-b">
          <div className="fld">
            <label>Format</label>
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
                <input type="radio" name="fmt" checked={format === "csv"} onChange={() => setFormat("csv")} style={{ width: "auto" }} /> CSV (spreadsheet)
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center", textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
                <input type="radio" name="fmt" checked={format === "pdf"} onChange={() => setFormat("pdf")} style={{ width: "auto" }} /> PDF
              </label>
            </div>
          </div>

          <div className="fld">
            <label>Filter the date range by</label>
            <select value={dateField} onChange={(e) => setDateField(e.target.value as DateField)}>
              <option value="date">Date of transaction</option>
              <option value="createdAt">Date added</option>
            </select>
          </div>

          <div className="fld-row">
            <div className="fld">
              <label>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="fld">
              <label>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <p className="hint" style={{ marginTop: -4 }}>
            Leave both blank to export everything. Both dates are always included as columns. {count} match right now.
          </p>

          {error && <p className="err">{error}</p>}
        </div>
        <div className="fd-modal-f">
          <button type="button" className="fd-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="fd-btn" onClick={run} disabled={busy}>
            {busy ? "Preparing…" : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
