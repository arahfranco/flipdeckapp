"use client";

import { useState } from "react";

interface Props {
  kind: "receipt" | "logo" | "property-photo";
  value?: string | null;
  onUploaded: (publicUrl: string) => void;
  label?: string;
}

export function FileUploadField({ kind, value, onUploaded, label = "File" }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const setupRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, contentType: file.type }),
      });
      if (!setupRes.ok) throw new Error((await setupRes.json()).error ?? "Could not start upload");
      const { uploadUrl, publicUrl } = await setupRes.json();

      // A bucket with no CORS rule for this origin rejects the browser's
      // preflight, which surfaces here as an opaque TypeError rather than a
      // status code — worth naming, since the fix is bucket config, not code.
      let putRes: Response;
      try {
        putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      } catch {
        throw new Error("Storage rejected the upload from this browser — the bucket needs a CORS rule for this site.");
      }
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status} from storage)`);

      onUploaded(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="fld">
      <label>{label}</label>
      {value && (
        <div style={{ marginBottom: 6, fontSize: 12 }}>
          <a href={value} target="_blank" rel="noreferrer" className="linkish">
            Current file ↗
          </a>
        </div>
      )}
      <input type="file" accept="image/*,application/pdf" onChange={handleChange} disabled={busy} />
      {busy && <p className="hint">Uploading…</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
