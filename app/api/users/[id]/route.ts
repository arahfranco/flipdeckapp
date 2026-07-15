import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole, wouldRemoveLastOwner } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(Role.OWNER);
  if ("error" in guard) return guard.error;

  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = name;
  }
  if ("phone" in body) data.phone = body.phone || null;

  if ("role" in body && body.role !== target.role) {
    if (!Object.values(Role).includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    // Guard against demoting the last remaining Owner (spec §4) — would lock
    // the company out of its own settings.
    if (await wouldRemoveLastOwner(params.id, body.role)) {
      return NextResponse.json({ error: "Can't demote the last remaining Owner" }, { status: 400 });
    }
    data.role = body.role;
  }

  if ("partnerId" in body) {
    const partnerId = body.partnerId || null;
    if (partnerId) {
      const alreadyLinked = await db.user.findFirst({ where: { partnerId, id: { not: params.id } } });
      if (alreadyLinked) {
        return NextResponse.json({ error: "That partner is already linked to another user" }, { status: 409 });
      }
    }
    data.partnerId = partnerId;
  }

  const updated = await db.user.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(Role.OWNER);
  if ("error" in guard) return guard.error;

  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Same last-owner guard as a role change — removing this user must not
  // leave the company with zero owners.
  if (await wouldRemoveLastOwner(params.id, Role.PARTNER)) {
    return NextResponse.json({ error: "Can't remove the last remaining Owner" }, { status: 400 });
  }

  await db.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
