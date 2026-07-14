import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/constants";
import { AccountSettingsForm } from "@/components/AccountSettingsForm";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id }, include: { partner: true } });
  if (!user) redirect("/login");

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Account</div>
          <h2>Your Account</h2>
        </div>
      </header>

      <div className="fd-card" style={{ maxWidth: 480 }}>
        <div className="fd-card-b">
          <div className="acct-id">
            <div className="av-lg">{initial}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{user.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
          <div className="fld">
            <label>Email</label>
            <div>{user.email}</div>
          </div>
          <AccountSettingsForm name={user.name} phone={user.phone} partnerLinked={Boolean(user.partner)} />
        </div>
      </div>
    </>
  );
}
