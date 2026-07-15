import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const guard = await requireAccess("payroll");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { propertyId, date, workerId, hours, rate, notes } = body;
  if (!propertyId || !date || !workerId || hours == null || rate == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const entry = await db.payrollEntry.create({
    data: { propertyId, date: new Date(date), workerId, hours, rate, notes: notes || null },
  });
  return NextResponse.json(entry, { status: 201 });
}
