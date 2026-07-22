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

      // The browser never exposes *why* a cross-origin request died — a missing
      // CORS rule, an ad blocker and an offline network all surface as the same
      // opaque TypeError. So report the origin (which is what a CORS rule must
      // match, character for character) and name the likely causes rather than
      // asserting one.
      let putRes: Response;
      try {
        putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      } catch (netErr) {
        const uploadHost = new URL(uploadUrl).host;
        console.error("Upload blocked", { origin: window.location.origin, uploadHost, netErr });
        throw new Error(
          `Upload blocked. Site "${window.location.origin}" -> storage "${uploadHost}". ` +
            `Either storage does not allow that site, or something in this browser or network blocked the request.`
        );
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
