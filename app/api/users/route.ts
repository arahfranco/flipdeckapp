import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

// Adding a user here is what makes them invite-able — sendVerificationRequest
// (auth.ts) only emails addresses that already have a User row, so this IS
// the invite step, not just profile bookkeeping.
export async function POST(req: Request) {
  const guard = await requireRole(Role.OWNER);
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role;
  const partnerId = body.partnerId || null;

  if (!email || !name) {
    return NextResponse.json({ error: "Email and name are required" }, { status: 400 });
  }
  if (!Object.values(Role).includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }

  if (partnerId) {
    const alreadyLinked = await db.user.findUnique({ where: { partnerId } });
    if (alreadyLinked) {
      return NextResponse.json({ error: "That partner is already linked to another user" }, { status: 409 });
    }
  }

  const user = await db.user.create({ data: { email, name, role, partnerId } });
  return NextResponse.json(user, { status: 201 });
}
