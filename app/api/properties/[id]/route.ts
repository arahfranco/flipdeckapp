import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { Status } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("properties");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["address", "mls", "type", "beds", "baths", "sqft", "lotSize", "stories", "photoUrl"]) {
    if (key in body) data[key] = body[key];
  }
  if (body.status) {
    if (!Object.values(Status).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }

  const property = await db.property.update({ where: { id: params.id }, data });
  return NextResponse.json(property);
}

// Cascade delete (spec §5): budget lines, expenses, payroll, and contributions
// are destroyed with the property (DB-level onDelete: Cascade in schema.prisma).
// Bank transactions are explicitly un-assigned first, NOT deleted — the money
// genuinely left the account, so the transaction returns to the review queue.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("properties");
  if ("error" in guard) return guard.error;

  const property = await db.property.findUnique({ where: { id: params.id } });
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.$transaction([
    db.bankTxn.updateMany({
      where: { propertyId: params.id },
      data: { propertyId: null, subcategory: null, reconciled: false },
    }),
    db.property.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
