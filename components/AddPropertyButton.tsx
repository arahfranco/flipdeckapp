"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/constants";
import { FileUploadField } from "./FileUploadField";

export function AddPropertyButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(Status.SCOUTING);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: formData.get("address"),
          mls: formData.get("mls"),
          type: formData.get("type"),
          beds: Number(formData.get("beds")),
          baths: Number(formData.get("baths")),
          sqft: Number(formData.get("sqft")),
          lotSize: Number(formData.get("lotSize")),
          stories: Number(formData.get("stories")),
          status: formData.get("status"),
          monthlyRent: formData.get("monthlyRent"),
          photoUrl,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not add property");
      const created = await res.json();
      setOpen(false);
      router.push(`/properties/${created.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="fd-btn sm" onClick={() => setOpen(true)}>
        + Add Property
      </button>
    );
  }

  return (
    <div className="fd-mask" onClick={() => !busy && setOpen(false)}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-h">
          <h3>Add Property</h3>
        </div>
        <form action={submit}>
          <div className="fd-modal-b">
            <div className="fld">
              <label>Address</label>
              <input type="text" name="address" required />
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>MLS # (optional)</label>
                <input type="text" name="mls" />
              </div>
              <div className="fld">
                <label>Type</label>
                <input type="text" name="type" required placeholder="Single Family" defaultValue="Single Family" />
              </div>
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Beds</label>
                <input type="number" name="beds" step="0.5" min="0" required />
              </div>
              <div className="fld">
                <label>Baths</label>
                <input type="number" name="baths" step="0.5" min="0" required />
              </div>
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Sqft</label>
                <input type="number" name="sqft" min="0" required />
              </div>
              <div className="fld">
                <label>Lot Size</label>
                <input type="number" name="lotSize" min="0" required />
              </div>
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Stories</label>
                <input type="number" name="stories" min="1" required defaultValue={1} />
              </div>
              <div className="fld">
                <label>Status</label>
                <select name="status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                  {Object.values(Status).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {status === Status.RENTED && (
              <div className="fld">
                <label>Monthly Rent</label>
                <input type="number" name="monthlyRent" step="0.01" min="0" placeholder="e.g. 1450" />
                <p className="hint">Shown on the property, and counted as rental income on Company Value.</p>
              </div>
            )}
            <FileUploadField kind="property-photo" value={photoUrl} onUploaded={setPhotoUrl} label="Photo (optional)" />
            <p className="hint">
              Comes with a blank standard budget checklist — fill in estimates on the Budget tab.
            </p>
            {error && <p className="err">{error}</p>}
          </div>
          <div className="fd-modal-f">
            <button type="button" className="fd-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="fd-btn" disabled={busy}>
              {busy ? "Adding…" : "Add Property"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
