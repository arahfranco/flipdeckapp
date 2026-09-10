"use client";

import { useState } from "react";

interface Props {
  initialToken: string | null;
  initialEnabled: boolean;
}

export function EntryLinkManager({ initialToken, initialEnabled }: Props) {
  const [token, setToken] = useState(initialToken);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/entry/${token}` : "";

  async function act(action: "enable" | "disable" | "rotate") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/entry-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setToken(data.token);
      setEnabled(data.enabled);
      setConfirmRotate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  }

  return (
    <div>
      <p className="hint" style={{ marginTop: 0 }}>
        A phone-friendly page your team can open — no login — to log expenses straight into the log. Anyone with the
        link can submit, so share it only with your team; disable or regenerate it anytime.
      </p>

      {!token ? (
        <button className="fd-btn" onClick={() => act("enable")} disabled={busy}>
          {busy ? "Creating…" : "Create shareable link"}
        </button>
      ) : (
        <>
          <div className="fld">
            <label>
              Team entry link{" "}
              <span className={`pill ${enabled ? "p-paid" : ""}`} style={{ marginLeft: 6 }}>
                {enabled ? "Active" : "Disabled"}
              </span>
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="text" readOnly value={url} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
              <button type="button" className="fd-btn sm" onClick={copy} disabled={!url}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            {!enabled && (
              <p className="hint" style={{ marginTop: 6 }}>
                The link is turned off — it won’t open until you enable it.
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {enabled ? (
              <button className="fd-btn ghost sm" onClick={() => act("disable")} disabled={busy}>
                Disable link
              </button>
            ) : (
              <button className="fd-btn sm" onClick={() => act("enable")} disabled={busy}>
                Enable link
              </button>
            )}
            {!confirmRotate ? (
              <button className="fd-btn ghost sm" onClick={() => setConfirmRotate(true)} disabled={busy}>
                Regenerate
              </button>
            ) : (
              <>
                <button className="fd-btn sm" onClick={() => act("rotate")} disabled={busy} style={{ background: "var(--neg)" }}>
                  {busy ? "Working…" : "Confirm — old link stops working"}
                </button>
                <button className="fd-btn ghost sm" onClick={() => setConfirmRotate(false)} disabled={busy}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </>
      )}

      {error && <p className="err">{error}</p>}
    </div>
  );
}
