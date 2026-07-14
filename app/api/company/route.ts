import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

// Company settings are Owner-only (spec §4, §5).
export async function PATCH(req: Request) {
  const guard = await requireRole(Role.OWNER);
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["name", "appName", "tagline", "email", "phone", "address", "logoUrl"]) {
    if (key in body) data[key] = body[key] || null;
  }
  if ("name" in data && !data.name) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const existing = await db.company.findFirst();
  const company = existing
    ? await db.company.update({ where: { id: existing.id }, data })
    : await db.company.create({ data: { name: "New Company", ...data } as { name: string } });

  return NextResponse.json(company);
}
