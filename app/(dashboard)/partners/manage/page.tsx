import Link from "next/link";
import { requireAccessPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { PartnerRow } from "@/components/PartnerRow";
import { AddPartnerButton } from "@/components/AddPartnerButton";

export default async function ManagePartnersPage() {
  await requireAccessPage("partners");

  const partners = await db.partner.findMany({
    include: { user: true, contributions: { select: { id: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <header className="fd-head">
        <div>
          <div className="fd-eyebrow">
            <Link href="/partners">Capital</Link>
          </div>
          <h2>Manage Partners</h2>
          <div className="fd-sub">Add, rename, or remove capital-ledger partner identities.</div>
        </div>
        <AddPartnerButton />
      </header>

      <div className="fd-card">
        <div className="fd-tw">
          <table className="fd-t">
            <thead>
              <tr>
                <th>Name</th>
                <th>Linked Login</th>
                <th className="num">Contributions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    No partners yet.
                  </td>
                </tr>
              )}
              {partners.map((p) => (
                <PartnerRow
                  key={p.id}
                  partner={{ id: p.id, name: p.name, hasUser: Boolean(p.user), contributionCount: p.contributions.length }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
