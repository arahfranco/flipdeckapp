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
  direction?: "IN" | "OUT";
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

interface Props {
  accounts: { id: string; name: string }[];
}

export function ImportCsvButton({ accounts }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [map, setMap] = useState<ColumnMap>({ date: null, desc: null, amount: null, debit: null, credit: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<{ imported: number; moneyIn: number; moneyOut: number } | null>(null);

  function reset() {
    setStep("pick");
    setAccountId(accounts[0]?.id ?? "");
    setCsvText("");
    setResult(null);
    setError(null);
    setImported(null);
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
        body: JSON.stringify({ csvText: text, accountId, map: mapOverride }),
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
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bank/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, map, accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImported(data);
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
      <button className="fd-btn sm" onClick={() => setOpen(true)} disabled={accounts.length === 0}>
        Import CSV
      </button>
    );
  }

  const accountName = accounts.find((a) => a.id === accountId)?.name ?? "";
  const freshItems = result?.items.filter((i) => i.status === "fresh") ?? [];
  const freshIn = freshItems.filter((i) => i.direction === "IN").length;

  return (
    <div className="fd-mask" onClick={() => !busy && close()}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="fd-modal-h">
          <h3>Import Bank CSV</h3>
        </div>
        <div className="fd-modal-b">
          {step === "pick" && (
            <>
              <div className="fld">
                <label>Account</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <p className="hint">
                  Duplicate detection is scoped to this account — the same statement imported into two accounts is
                  two genuinely different sets of transactions.
                </p>
              </div>
              <div className="fld">
                <label>CSV file</label>
                <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy || !accountId} />
              </div>
            </>
          )}

          {step === "mapping" && result && (
            <>
              <p className="hint" style={{ marginBottom: 12 }}>
                This file&apos;s headers weren&apos;t recognized. Point each field at the right column.
              </p>
              {(["date", "desc", "amount", "debit", "credit"] as const).map((field) => (
                <div className="fld" key={field}>
                  <label>
                    {field === "desc"
                      ? "Description"
                      : field === "debit"
                        ? "Debit / withdrawal (optional)"
                        : field === "credit"
                          ? "Credit / deposit (optional)"
                          : field[0].toUpperCase() + field.slice(1)}
                  </label>
                  <select
                    value={map[field] ?? ""}
                    onChange={(e) => setMap({ ...map, [field]: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">{field === "debit" || field === "credit" ? "— none —" : "Choose…"}</option>
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
              <p style={{ marginBottom: 10 }}>
                Importing into <strong>{accountName}</strong> — <strong>{result.fresh}</strong> new (
                {freshIn} in, {result.fresh - freshIn} out), <strong>{result.dupes}</strong> already imported,{" "}
                <strong>{result.skips}</strong> skipped.
              </p>
              {result.fresh > 0 && (
                <div className="fd-tw" style={{ maxHeight: 260, overflowY: "auto" }}>
                  <table className="fd-t">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Direction</th>
                        <th className="num">Amount</th>
                        <th>Suggested Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {freshItems.map((i) => (
                        <tr key={i.line}>
                          <td>{i.date}</td>
                          <td>{i.description}</td>
                          <td>
                            <span className={`pill ${i.direction === "IN" ? "p-equity" : "p-draw"}`}>
                              {i.direction === "IN" ? "In" : "Out"}
                            </span>
                          </td>
                          <td className={`num ${i.direction === "IN" ? "pos" : ""}`}>
                            {i.direction === "IN" ? "+" : "−"}
                            {money2(i.amount ?? 0)}
                          </td>
                          <td>{i.guess ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="hint" style={{ marginTop: 10 }}>
                Check the direction column before importing — money out becomes an expense, money in becomes
                property income, and both feed the account&apos;s balance. Imported rows land unassigned in the
                review queue; suggested categories are a starting point, not applied automatically.
              </p>
            </>
          )}

          {step === "done" && imported && (
            <p className="ok">
              Imported {imported.imported} transaction{imported.imported === 1 ? "" : "s"} into {accountName} —{" "}
              {imported.moneyIn} in, {imported.moneyOut} out.
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
            <button className="fd-btn" onClick={confirmImport} disabled={busy}>
              {busy ? "Importing…" : `Import ${result.fresh} Transaction${result.fresh === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
