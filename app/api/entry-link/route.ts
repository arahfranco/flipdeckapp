import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { generateEntryToken } from "@/lib/entryLink";

// Owner-only management of the public expense-entry link. Enable generates a
// token if there isn't one; rotate issues a new token (invalidating any shared
// link) and keeps the current on/off state; disable flips the kill switch.
export async function POST(req: Request) {
  const guard = await requireRole(Role.OWNER);
  if ("error" in guard) return guard.error;

  const company = await db.company.findFirst();
  if (!company) {
    return NextResponse.json({ error: "Save your Company Settings first." }, { status: 400 });
  }

  const { action } = await req.json().catch(() => ({ action: "" }));

  let entryToken = company.entryToken;
  let entryEnabled = company.entryEnabled;

  if (action === "enable") {
    if (!entryToken) entryToken = generateEntryToken();
    entryEnabled = true;
  } else if (action === "disable") {
    entryEnabled = false;
  } else if (action === "rotate") {
    entryToken = generateEntryToken();
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await db.company.update({ where: { id: company.id }, data: { entryToken, entryEnabled } });
  return NextResponse.json({ token: entryToken, enabled: entryEnabled });
}
