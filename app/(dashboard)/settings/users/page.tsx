import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { UserRow } from "@/components/UserRow";
import { AddUserButton } from "@/components/AddUserButton";

export default async function UsersPage() {
  const guard = await requireRole(Role.OWNER);
  if ("error" in guard) {
    return (
      <div className="empty">
        <b>Owner access required</b>
        User management is visible to the Owner role only.
      </div>
    );
  }

  const session = await auth();
  if (!session?.user) redirect("/login");

  const [users, partners] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    db.partner.findMany({ include: { user: true }, orderBy: { name: "asc" } }),
  ]);

  const unlinkedPartners = partners.filter((p) => !p.user);

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">Admin</div>
          <h2>Users</h2>
          <div className="fd-sub">Add teammates, change roles, link partner identities.</div>
        </div>
        <AddUserButton partners={unlinkedPartners} />
      </header>

      <div className="fd-card">
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                // A user editing their own row still needs their current partner
                // link to appear in the dropdown, not just the unlinked ones.
                const availablePartners = partners.filter((p) => !p.user || p.id === u.partnerId);
                return (
                  <UserRow
                    key={u.id}
                    user={{
                      id: u.id,
                      name: u.name,
                      email: u.email,
                      phone: u.phone,
                      role: u.role,
                      partnerId: u.partnerId,
                    }}
                    partners={availablePartners.map((p) => ({ id: p.id, name: p.name }))}
                    isSelf={u.id === session.user.id}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
