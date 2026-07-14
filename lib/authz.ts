import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "./db";
import { CAN_SEE, type Section } from "./constants";
export type { Section };

export interface AuthSession {
  user: { id: string; role: Role; partnerId: string | null };
}

type Guard = { session: AuthSession } | { error: NextResponse };

/**
 * The actual authorization boundary. CAN_SEE (lib/constants.ts) is shared with
 * the client for hiding nav items, but that is UI convenience only — a user
 * could otherwise call e.g. GET /api/payroll directly and bypass a hidden tab.
 * Every API route that touches a section must call this (spec §4).
 */
export async function requireAccess(section: Section): Promise<Guard> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!CAN_SEE[session.user.role]?.includes(section)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session: session as AuthSession };
}

/**
 * Same boundary as requireAccess, for use inside Server Components (pages),
 * which can't return a NextResponse — redirects instead. The nav (components/Nav.tsx)
 * already hides sections the role can't see; this is what stops a direct URL visit
 * from working anyway.
 */
export async function requireAccessPage(section: Section): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!CAN_SEE[session.user.role]?.includes(section)) redirect("/");
  return session as AuthSession;
}

/** For actions gated by role rather than by section (e.g. company settings = Owner-only). */
export async function requireRole(...roles: Role[]): Promise<Guard> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!roles.includes(session.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session: session as AuthSession };
}

/**
 * Guard against demoting/deleting the last remaining OWNER, which would lock
 * the company out of its own settings (spec §4). Call before persisting a
 * role change or user deletion where the target is currently an OWNER.
 */
export async function wouldRemoveLastOwner(targetUserId: string, newRole: Role): Promise<boolean> {
  if (newRole === Role.OWNER) return false;
  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (target?.role !== Role.OWNER) return false;
  const ownerCount = await db.user.count({ where: { role: Role.OWNER } });
  return ownerCount <= 1;
}
