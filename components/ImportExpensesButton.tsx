"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";
import { buildExpenseImport, expenseTemplateCsv, type ExpenseImportResult } from "@/lib/expenseImport";

interface Props {
  properties: { id: string; address: string }[];
  /** subcategories valid for expenses (Selling Price excluded), for the template + validation */
  subcategories: string[];
}

type Step = "pick" | "preview" | "done";

export function ImportExpensesButton({ properties, subcategories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<ExpenseImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(0);
  const [ignoreBlanks, setIgnoreBlanks] = useState(true);
  // Dates typed into the preview for rows whose date cell was blank, by line.
  const [dates, setDates] = useState<Record<number, string>>({});

  function reset() {
    setStep("pick");
    setPropertyId(properties[0]?.id ?? "");
    setCsvText("");
    setResult(null);
    setError(null);
    setImported(0);
    setIgnoreBlanks(true);
    setDates({});
  }
  function close() {
    setOpen(false);
    reset();
  }

  function downloadTemplate() {
    const blob = new Blob([expenseTemplateCsv(subcategories)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flipdeck-expenses-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setDates({});
    setResult(buildExpenseImport(text, subcategories, { ignoreBlanks })); // instant client-side preview
    setStep("preview");
    e.target.value = "";
  }

  // Re-parse when the blanks toggle flips so the preview reflects it immediately.
  function toggleIgnoreBlanks(v: boolean) {
    setIgnoreBlanks(v);
    if (csvText) setResult(buildExpenseImport(csvText, subcategories, { ignoreBlanks: v }));
  }

  async function confirmImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/expenses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, csvText, ignoreBlanks, dates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImported(data.imported);
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="fd-btn ghost sm" onClick={() => setOpen(true)} disabled={properties.length === 0}>
        Bulk Import
      </button>
    );
  }

  const okRows = result?.rows.filter((r) => r.ok) ?? [];
  const needsDateRows = result?.rows.filter((r) => r.needsDate) ?? [];
  const badRows = result?.rows.filter((r) => !r.ok && !r.needsDate) ?? [];
  const datedNeedsDate = needsDateRows.filter((r) => dates[r.line]);
  const importCount = okRows.length + datedNeedsDate.length;
  const propertyName = properties.find((p) => p.id === propertyId)?.address ?? "";

  return (
    <div className="fd-mask" onClick={() => !busy && close()}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="fd-modal-h">
          <h3>Bulk Import Expenses</h3>
        </div>
        <div className="fd-modal-b">
          {step === "pick" && (
            <>
              <div className="fld">
                <label>Property</label>
                <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}
                    </option>
                  ))}
                </select>
                <p className="hint">Every row in the file is imported against this property.</p>
              </div>

              <ol className="steps-list">
                <li>
                  <b>Download the template</b> — it already has the right columns and example rows.
                  <div style={{ marginTop: 8 }}>
                    <button className="fd-btn sm" onClick={downloadTemplate} type="button">
                      ↓ Download CSV template
                    </button>
                  </div>
                </li>
                <li>
                  <b>Fill it in</b> in Excel or Google Sheets — one expense per row. Delete the example rows.
                </li>
                <li>
                  <b>Save as CSV</b> and upload it here.
                  <div style={{ marginTop: 8 }}>
                    <input type="file" accept=".csv,text/csv" onChange={handleFile} />
                  </div>
                </li>
              </ol>

              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14 }}>
                <input
                  type="checkbox"
                  checked={ignoreBlanks}
                  onChange={(e) => toggleIgnoreBlanks(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <b>Ignore blank rows</b>
                  <span className="hint" style={{ display: "block" }}>
                    Skip rows missing an amount or subcategory instead of listing them as problems. A row missing only
                    its date isn’t skipped — you can add the date below.
                  </span>
                </span>
              </label>

              <details style={{ marginTop: 14 }}>
                <summary className="hint" style={{ cursor: "pointer" }}>
                  Valid subcategory names ({subcategories.length}) — copy these exactly
                </summary>
                <div className="sub-list">
                  {subcategories.map((s) => (
                    <span key={s} className="sub-chip">
                      {s}
                    </span>
                  ))}
                </div>
              </details>
              <p className="hint" style={{ marginTop: 12 }}>
                Columns: <b>Date</b> (YYYY-MM-DD), <b>Subcategory</b>, <b>Amount</b>, <b>Description</b> (optional),{" "}
                <b>Status</b> (Pending/Paid/Reimbursed — optional, defaults to Pending).
              </p>
            </>
          )}

          {step === "preview" && result && (
            <>
              {result.headerError ? (
                <p className="err">{result.headerError}</p>
              ) : (
                <>
                  <p style={{ marginBottom: 10 }}>
                    Importing into <strong>{propertyName}</strong> — <strong>{okRows.length}</strong> ready
                    {needsDateRows.length > 0 && (
                      <>
                        , <strong>{needsDateRows.length}</strong> need a date
                      </>
                    )}
                    , <strong>{badRows.length}</strong> with problems.
                  </p>

                  {okRows.length > 0 && (
                    <div className="fd-tw" style={{ maxHeight: 220, overflowY: "auto" }}>
                      <table className="fd-t">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Subcategory</th>
                            <th>Description</th>
                            <th className="num">Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {okRows.map((r) => (
                            <tr key={r.line}>
                              <td>{r.date}</td>
                              <td>{r.subcategory}</td>
                              <td>{r.description || <span className="hint">—</span>}</td>
                              <td className="num">{money2(r.amount ?? 0)}</td>
                              <td>{r.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {needsDateRows.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ marginBottom: 6 }}>
                        These rows are missing a date — pick one to include them. Any left blank are skipped.
                      </p>
                      <div className="fd-tw" style={{ maxHeight: 220, overflowY: "auto" }}>
                        <table className="fd-t">
                          <thead>
                            <tr>
                              <th style={{ width: 170 }}>Date</th>
                              <th>Subcategory</th>
                              <th>Description</th>
                              <th className="num">Amount</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {needsDateRows.map((r) => (
                              <tr key={r.line}>
                                <td>
                                  <input
                                    type="date"
                                    value={dates[r.line] ?? ""}
                                    onChange={(e) => setDates((d) => ({ ...d, [r.line]: e.target.value }))}
                                    style={{ width: 150 }}
                                  />
                                </td>
                                <td>{r.subcategory}</td>
                                <td>{r.description || <span className="hint">—</span>}</td>
                                <td className="num">{money2(r.amount ?? 0)}</td>
                                <td>{r.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {badRows.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <p className="err" style={{ marginBottom: 6 }}>
                        These rows will be skipped — fix them in the file and re-upload if you want them in:
                      </p>
                      <ul className="err-list">
                        {badRows.map((r) => (
                          <li key={r.line}>
                            <b>Row {r.line}:</b> {r.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {error && <p className="err">{error}</p>}
            </>
          )}

          {step === "done" && (
            <p className="ok">
              Imported {imported} expense{imported === 1 ? "" : "s"} into {propertyName}. They now roll into its
              Budget actuals.
            </p>
          )}
        </div>
        <div className="fd-modal-f">
          <button className="fd-btn ghost" onClick={close} disabled={busy}>
            {step === "done" ? "Close" : "Cancel"}
          </button>
          {step === "preview" && (
            <>
              <button className="fd-btn ghost" onClick={() => setStep("pick")} disabled={busy}>
                Back
              </button>
              {importCount > 0 && (
                <button className="fd-btn" onClick={confirmImport} disabled={busy}>
                  {busy ? "Importing…" : `Import ${importCount} Expense${importCount === 1 ? "" : "s"}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
