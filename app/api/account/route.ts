import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// Self-service — any signed-in user may edit their own name/phone (not role
// or email, which are identity/authorization-sensitive).
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A partner's display name follows the linked user's name (spec §5) — the
  // User.partnerId link is what makes renaming here ripple through the
  // capital ledger, which reads Partner.name, not User.name.
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: user.id }, data: { name, phone: phone || null } });
    if (user.partnerId) {
      await tx.partner.update({ where: { id: user.partnerId }, data: { name } });
    }
    return u;
  });

  return NextResponse.json(updated);
}
