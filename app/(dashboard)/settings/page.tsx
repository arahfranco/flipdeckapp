import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { CompanySettingsForm } from "@/components/CompanySettingsForm";
import { EntryLinkManager } from "@/components/EntryLinkManager";

export default async function SettingsPage() {
  const guard = await requireRole(Role.OWNER);
  if ("error" in guard) {
    return (
      <div className="empty">
        <b>Owner access required</b>
        Company settings are visible to the Owner role only.
      </div>
    );
  }

  const company = await db.company.findFirst();

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Admin</div>
          <h2>Company Settings</h2>
        </div>
      </header>

      <div className="fd-card" style={{ maxWidth: 480 }}>
        <div className="fd-card-b">
          <CompanySettingsForm
            company={{
              name: company?.name ?? "",
              appName: company?.appName ?? "Flipdeck",
              tagline: company?.tagline ?? null,
              email: company?.email ?? null,
              phone: company?.phone ?? null,
              address: company?.address ?? null,
              logoUrl: company?.logoUrl ?? null,
            }}
          />
        </div>
      </div>

      <div className="fd-card" style={{ maxWidth: 480, marginTop: 22 }}>
        <div className="fd-card-h">
          <h3>Team expense-entry link</h3>
        </div>
        <div className="fd-card-b">
          <EntryLinkManager
            initialToken={company?.entryToken ?? null}
            initialEnabled={company?.entryEnabled ?? false}
          />
        </div>
      </div>
    </>
  );
}
