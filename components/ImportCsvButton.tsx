"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";

interface ColumnMap {
  date: number | null;
  desc: number | null;
  amount: number | null;
  debit: number | null;
  credit: number | null;
}

interface ImportItem {
  line: number;
  status: "fresh" | "dupe" | "skip";
  date?: string;
  description?: string;
  amount?: number;
  guess?: string | null;
  skipReason?: string;
}

interface ImportResult {
  needsMapping?: boolean;
  header?: string[];
  sampleRows?: string[][];
  map: ColumnMap;
  items: ImportItem[];
  fresh: number;
  dupes: number;
  skips: number;
  error?: string;
}

type Step = "pick" | "mapping" | "preview" | "done";

export function ImportCsvButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [account, setAccount] = useState("");
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [map, setMap] = useState<ColumnMap>({ date: null, desc: null, amount: null, debit: null, credit: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  function reset() {
    setStep("pick");
    setAccount("");
    setCsvText("");
    setResult(null);
    setError(null);
    setImportedCount(0);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    await runPreview(text, undefined);
  }

  async function runPreview(text: string, mapOverride: ColumnMap | undefined) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bank/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text, map: mapOverride }),
      });
      const data: ImportResult = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not parse file");
      if (data.error) throw new Error(data.error);
      setResult(data);
      setMap(data.map);
      setStep(data.needsMapping ? "mapping" : "preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMapping() {
    await runPreview(csvText, map);
  }

  async function confirmImport() {
    if (!account.trim()) {
      setError("Account name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bank/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, map, account }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportedCount(data.imported);
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    reset();
  }

  if (!open) {
    return (
      <button className="fd-btn sm" onClick={() => setOpen(true)}>
        Import CSV
      </button>
    );
  }

  return (
    <div className="fd-mask" onClick={() => !busy && close()}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="fd-modal-h">
          <h3>Import Bank CSV</h3>
        </div>
        <div className="fd-modal-b">
          {step === "pick" && (
            <>
              <div className="fld">
                <label>Account name</label>
                <input
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="Chase •4471"
                  required
                />
              </div>
              <div className="fld">
                <label>CSV file</label>
                <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy || !account.trim()} />
                {!account.trim() && <p className="hint">Enter the account name first.</p>}
              </div>
            </>
          )}

          {step === "mapping" && result && (
            <>
              <p className="hint" style={{ marginBottom: 12 }}>
                This file&apos;s headers weren&apos;t recognized. Point each field at the right column.
              </p>
              {(["date", "desc", "amount", "debit"] as const).map((field) => (
                <div className="fld" key={field}>
                  <label>{field === "desc" ? "Description" : field === "debit" ? "Debit / withdrawal (optional)" : field[0].toUpperCase() + field.slice(1)}</label>
                  <select
                    value={map[field] ?? ""}
                    onChange={(e) => setMap({ ...map, [field]: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">{field === "debit" ? "— none —" : "Choose…"}</option>
                    {result.header?.map((h, i) => (
                      <option key={i} value={i}>
                        {h?.trim() || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {result.sampleRows && (
                <div className="fd-tw" style={{ marginTop: 14 }}>
                  <table className="fd-t">
                    <thead>
                      <tr>
                        {result.header?.map((h, i) => (
                          <th key={i}>{h?.trim() || `Col ${i + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.sampleRows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => (
                            <td key={j} style={{ fontSize: 11.5 }}>
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {step === "preview" && result && (
            <>
              <div className="fld">
                <label>Account name</label>
                <input type="text" value={account} onChange={(e) => setAccount(e.target.value)} required />
              </div>
              <p style={{ marginBottom: 10 }}>
                <strong>{result.fresh}</strong> new, <strong>{result.dupes}</strong> already imported,{" "}
                <strong>{result.skips}</strong> skipped (deposits or unreadable rows).
              </p>
              {result.fresh > 0 && (
                <div className="fd-tw" style={{ maxHeight: 260, overflowY: "auto" }}>
                  <table className="fd-t">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th className="num">Amount</th>
                        <th>Suggested Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items
                        .filter((i) => i.status === "fresh")
                        .map((i) => (
                          <tr key={i.line}>
                            <td>{i.date}</td>
                            <td>{i.description}</td>
                            <td className="num">{money2(i.amount ?? 0)}</td>
                            <td>{i.guess ?? "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="hint" style={{ marginTop: 10 }}>
                Imported rows land unassigned in the review queue — assign a property + subcategory and post them
                from there. Suggested categories are a starting point, not applied automatically.
              </p>
            </>
          )}

          {step === "done" && (
            <p className="ok">
              Imported {importedCount} transaction{importedCount === 1 ? "" : "s"}.
            </p>
          )}

          {error && <p className="err">{error}</p>}
        </div>
        <div className="fd-modal-f">
          <button className="fd-btn ghost" onClick={close} disabled={busy}>
            {step === "done" ? "Close" : "Cancel"}
          </button>
          {step === "mapping" && (
            <button className="fd-btn" onClick={confirmMapping} disabled={busy || map.date == null || map.desc == null}>
              {busy ? "…" : "Continue"}
            </button>
          )}
          {step === "preview" && result && result.fresh > 0 && (
            <button className="fd-btn" onClick={confirmImport} disabled={busy || !account.trim()}>
              {busy ? "Importing…" : `Import ${result.fresh} Transaction${result.fresh === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
