"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { CAN_SEE, ROLE_LABELS, type Section } from "@/lib/constants";

const NAV_ITEMS: { section: Section; label: string; href: string }[] = [
  { section: "portfolio", label: "Portfolio", href: "/" },
  { section: "properties", label: "Properties", href: "/properties" },
  { section: "expenses", label: "Expenses", href: "/expenses" },
  { section: "bank", label: "Bank", href: "/bank" },
  { section: "payroll", label: "Payroll", href: "/payroll" },
  { section: "partners", label: "Capital", href: "/partners" },
  // Same "partners" gate — the balance sheet exposes equity positions, which
  // spec §4 keeps away from Bookkeepers.
  { section: "partners", label: "Company Value", href: "/company" },
];

interface NavProps {
  companyName: string;
  appName: string;
  user: { name: string; role: Role };
}

export function Nav({ companyName, appName, user }: NavProps) {
  const pathname = usePathname();
  const allowed = CAN_SEE[user.role] ?? [];
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <nav className="fd-nav">
      <div className="fd-brand">
        <h1>{appName}</h1>
        <span>{companyName}</span>
      </div>

      {NAV_ITEMS.filter((item) => allowed.includes(item.section)).map((item) => (
        <Link
          key={item.section}
          href={item.href}
          className={`fd-nav-item${pathname === item.href ? " on" : ""}`}
        >
          {item.label}
        </Link>
      ))}

      {user.role === "OWNER" && (
        <>
          <div className="fd-nav-sec">Admin</div>
          <Link href="/settings" className={`fd-nav-item${pathname === "/settings" ? " on" : ""}`}>
            Company Settings
          </Link>
          <Link href="/settings/users" className={`fd-nav-item${pathname === "/settings/users" ? " on" : ""}`}>
            Users
          </Link>
        </>
      )}

      <div className="fd-user">
        <Link href="/account" className={`fd-me${pathname === "/account" ? " on" : ""}`}>
          <span className="av-sm">{initial}</span>
          <span>
            <span className="nm">{user.name}</span>
            <span className="rl">{ROLE_LABELS[user.role]}</span>
          </span>
        </Link>
      </div>
    </nav>
  );
}
