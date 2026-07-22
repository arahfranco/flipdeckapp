"use client";

import { useState } from "react";

interface Props {
  kind: "receipt" | "logo" | "property-photo";
  value?: string | null;
  onUploaded: (publicUrl: string) => void;
  label?: string;
}

// Serverless caps the request body at 4.5 MB, and a phone photo is routinely
// larger than that. Downscaling here keeps uploads well under the limit and
// costs nothing visually — property photos are displayed at most 1280px wide.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

/** Animated GIFs would lose their frames on a canvas, and PDFs aren't images. */
const RESIZABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

async function downscale(file: File): Promise<Blob> {
  if (!RESIZABLE.has(file.type)) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // corrupt or unsupported — let the server judge it

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 3 * 1024 * 1024) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // PNG screenshots of receipts compress far better as JPEG, and transparency
  // is irrelevant for photos — so everything resizable normalises to JPEG.
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  return blob && blob.size < file.size ? blob : file;
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
      const body = await downscale(file);
      const form = new FormData();
      form.append("kind", kind);
      // Name the part after the original file so the extension survives, but
      // carry the possibly-converted type.
      form.append("file", new File([body], file.name, { type: body.type || file.type }));

      // Same-origin — no CORS, and nothing between the browser and Cloudflare
      // to veto it. A failure here comes back as a real status and message.
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);

      onUploaded(data.publicUrl);
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
