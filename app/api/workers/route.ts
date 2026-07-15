import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const guard = await requireAccess("payroll");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const existing = await db.worker.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: "A worker with that name already exists" }, { status: 409 });

  const worker = await db.worker.create({
    data: { name, defaultRate: body.defaultRate != null && body.defaultRate !== "" ? Number(body.defaultRate) : null },
  });
  return NextResponse.json(worker, { status: 201 });
}
