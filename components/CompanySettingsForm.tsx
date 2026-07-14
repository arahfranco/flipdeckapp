"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUploadField } from "./FileUploadField";

interface Company {
  name: string;
  appName: string;
  tagline: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
}

export function CompanySettingsForm({ company }: { company: Company }) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(company.logoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          appName: formData.get("appName"),
          tagline: formData.get("tagline"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          address: formData.get("address"),
          logoUrl,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit}>
      <div className="fld">
        <label>Name</label>
        <input type="text" name="name" defaultValue={company.name} required />
      </div>
      <div className="fld-row">
        <div className="fld">
          <label>App Name</label>
          <input type="text" name="appName" defaultValue={company.appName} />
        </div>
        <div className="fld">
          <label>Tagline</label>
          <input type="text" name="tagline" defaultValue={company.tagline ?? ""} />
        </div>
      </div>
      <div className="fld-row">
        <div className="fld">
          <label>Email</label>
          <input type="email" name="email" defaultValue={company.email ?? ""} />
        </div>
        <div className="fld">
          <label>Phone</label>
          <input type="text" name="phone" defaultValue={company.phone ?? ""} />
        </div>
      </div>
      <div className="fld">
        <label>Address</label>
        <input type="text" name="address" defaultValue={company.address ?? ""} />
      </div>
      <FileUploadField kind="logo" value={logoUrl} onUploaded={setLogoUrl} label="Logo" />
      {error && <p className="err">{error}</p>}
      {saved && !error && <p className="ok">Saved.</p>}
      <button type="submit" className="fd-btn" disabled={busy} style={{ marginTop: 10 }}>
        {busy ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
