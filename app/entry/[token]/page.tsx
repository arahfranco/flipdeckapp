import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ALL_SUBS } from "@/lib/constants";
import { resolveEntryCompany } from "@/lib/entryLink";
import { PublicExpenseForm } from "@/components/PublicExpenseForm";

// Public, no-login page for the field team to log expenses. It lives OUTSIDE
// the (dashboard) group, so it gets no nav and no auth guard — the token is the
// only gate. Always dynamic: it's keyed on the token and reads live data.
export const dynamic = "force-dynamic";

export default async function EntryPage({ params }: { params: { token: string } }) {
  const company = await resolveEntryCompany(params.token);
  if (!company) notFound();

  const [properties] = await Promise.all([
    db.property.findMany({ select: { id: true, address: true }, orderBy: { address: "asc" } }),
  ]);
  const subcategories = ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 64px" }}>
      <header style={{ marginBottom: 18 }}>
        <div className="fd-eyebrow">{company.appName}</div>
        <h2 style={{ margin: "2px 0 4px" }}>Log an expense</h2>
        <div className="fd-sub">
          {company.name ? `${company.name} — ` : ""}fill this in and tap Submit. You can add several in a row.
        </div>
      </header>

      <div className="fd-card">
        <div className="fd-card-b">
          <PublicExpenseForm token={company.entryToken!} properties={properties} subcategories={subcategories} />
        </div>
      </div>

      <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
        Entries go straight to the {company.appName} expense log for review.
      </p>
    </div>
  );
}
