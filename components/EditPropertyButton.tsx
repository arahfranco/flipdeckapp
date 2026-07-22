"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/constants";
import { FileUploadField } from "./FileUploadField";

interface Props {
  property: {
    id: string;
    address: string;
    mls: string | null;
    type: string;
    beds: number;
    baths: number;
    sqft: number;
    lotSize: number;
    stories: number;
    status: Status;
    photoUrl: string | null;
    marketValue: string | null;
    monthlyRent: string | null;
  };
}

export function EditPropertyButton({ property }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(property.photoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
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
          marketValue: formData.get("marketValue"),
          monthlyRent: formData.get("monthlyRent"),
          photoUrl,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="fd-btn ghost sm" onClick={() => setOpen(true)}>
        Edit Property
      </button>
    );
  }

  return (
    <div className="fd-mask" onClick={() => !busy && setOpen(false)}>
      <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-h">
          <h3>Edit Property</h3>
        </div>
        <form action={submit}>
          <div className="fd-modal-b">
            <div className="fld">
              <label>Address</label>
              <input type="text" name="address" defaultValue={property.address} required />
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>MLS #</label>
                <input type="text" name="mls" defaultValue={property.mls ?? ""} />
              </div>
              <div className="fld">
                <label>Type</label>
                <input type="text" name="type" defaultValue={property.type} required />
              </div>
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Beds</label>
                <input type="number" name="beds" step="0.5" min="0" defaultValue={property.beds} required />
              </div>
              <div className="fld">
                <label>Baths</label>
                <input type="number" name="baths" step="0.5" min="0" defaultValue={property.baths} required />
              </div>
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Sqft</label>
                <input type="number" name="sqft" min="0" defaultValue={property.sqft} required />
              </div>
              <div className="fld">
                <label>Lot Size</label>
                <input type="number" name="lotSize" min="0" defaultValue={property.lotSize} required />
              </div>
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Stories</label>
                <input type="number" name="stories" min="1" defaultValue={property.stories} required />
              </div>
              <div className="fld">
                <label>Status</label>
                <select name="status" defaultValue={property.status}>
                  {Object.values(Status).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="fld-row">
              <div className="fld">
                <label>Market Value</label>
                <input
                  type="number"
                  name="marketValue"
                  step="0.01"
                  min="0"
                  defaultValue={property.marketValue ?? ""}
                  placeholder="Current ARV"
                />
                <p className="hint">Leave blank to use the estimated Sale Price on the Company Value dashboard.</p>
              </div>
              <div className="fld">
                <label>Monthly Rent</label>
                <input
                  type="number"
                  name="monthlyRent"
                  step="0.01"
                  min="0"
                  defaultValue={property.monthlyRent ?? ""}
                  placeholder="If rented"
                />
              </div>
            </div>
            <FileUploadField kind="property-photo" value={photoUrl} onUploaded={setPhotoUrl} label="Photo" />
            {error && <p className="err">{error}</p>}
          </div>
          <div className="fd-modal-f">
            <button type="button" className="fd-btn ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="fd-btn" disabled={busy}>
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
