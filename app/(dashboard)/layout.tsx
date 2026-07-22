import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Nav } from "@/components/Nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await db.company.findFirst();

  return (
    <div className="fd-shell">
      <Nav
        companyName={company?.name ?? "Flipdeck"}
        appName={company?.appName ?? "Flipdeck"}
        user={{ name: session.user.name ?? session.user.email ?? "User", role: session.user.role }}
      />
      <main className="fd-main">{children}</main>
    </div>
  );
}
