import type { Metadata } from "next";
import { db } from "@/lib/db";
import "./globals.css";

// Read from the Company record so a new instance is branded by editing
// Settings, not by editing source. Falls back to the neutral product name
// rather than any one company's, and tolerates the database being unreachable
// so a build can never fail on account of a page title.
export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await db.company.findFirst();
    const appName = company?.appName || "Flipdeck";
    return {
      title: appName,
      description: company?.name ? `Fix & Flip Ledger — ${company.name}` : "Fix & Flip Ledger",
    };
  } catch {
    return { title: "Flipdeck", description: "Fix & Flip Ledger" };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="fd">{children}</div>
      </body>
    </html>
  );
}
