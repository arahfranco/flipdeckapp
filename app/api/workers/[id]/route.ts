import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("payroll");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = name;
  }
  if ("defaultRate" in body) {
    data.defaultRate = body.defaultRate != null && body.defaultRate !== "" ? Number(body.defaultRate) : null;
  }

  try {
    const worker = await db.worker.update({ where: { id: params.id }, data });
    return NextResponse.json(worker);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A worker with that name already exists" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAccess("payroll");
  if ("error" in guard) return guard.error;

  const count = await db.payrollEntry.count({ where: { workerId: params.id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `Can't delete — ${count} payroll ${count === 1 ? "entry references" : "entries reference"} this worker` },
      { status: 409 }
    );
  }

  await db.worker.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
