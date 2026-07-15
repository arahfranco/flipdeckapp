import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const existing = await db.partner.findUnique({ where: { id: params.id }, include: { user: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Same identity, two records — keep them in sync regardless of which side
  // initiates the rename (spec §5 already keeps this in sync the other way,
  // via Account Settings).
  const [partner] = await db.$transaction([
    db.partner.update({ where: { id: params.id }, data: { name } }),
    ...(existing.user ? [db.user.update({ where: { id: existing.user.id }, data: { name } })] : []),
  ]);

  return NextResponse.json(partner);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("partners");
  if ("error" in guard) return guard.error;

  const partner = await db.partner.findUnique({
    where: { id: params.id },
    include: { user: true, contributions: { select: { id: true } } },
  });
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (partner.contributions.length > 0) {
    return NextResponse.json(
      {
        error: `Can't delete — ${partner.contributions.length} capital contribution${partner.contributions.length === 1 ? "" : "s"} reference this partner`,
      },
      { status: 409 }
    );
  }

  await db.$transaction([
    // Unlink any signed-in user first — deleting the Partner must not delete
    // their login, those are separate concepts (spec §4/§5).
    ...(partner.user ? [db.user.update({ where: { id: partner.user.id }, data: { partnerId: null } })] : []),
    db.partner.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
