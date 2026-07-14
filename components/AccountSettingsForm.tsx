"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  name: string;
  phone: string | null;
  partnerLinked: boolean;
}

export function AccountSettingsForm({ name, phone, partnerLinked }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), phone: formData.get("phone") }),
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
        <input type="text" name="name" defaultValue={name} required />
      </div>
      <div className="fld">
        <label>Phone</label>
        <input type="text" name="phone" defaultValue={phone ?? ""} />
      </div>
      {partnerLinked && (
        <p className="hint">
          Renaming yourself here renames you throughout the capital ledger — it&apos;s the same identity.
        </p>
      )}
      {error && <p className="err">{error}</p>}
      {saved && !error && <p className="ok">Saved.</p>}
      <button type="submit" className="fd-btn" disabled={busy} style={{ marginTop: 10 }}>
        {busy ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
