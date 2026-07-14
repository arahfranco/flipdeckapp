import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flipdeck",
  description: "Fix & Flip Ledger — Foundational Real Estate",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="fd">{children}</div>
      </body>
    </html>
  );
}
