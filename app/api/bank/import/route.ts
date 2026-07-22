import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { buildImport, type ColumnMap } from "@/lib/csvImport";

// Preview only — does not touch the database. Dedup is scoped to the target
// account, since the same statement imported into two accounts is genuinely
// two different sets of transactions.
export async function POST(req: Request) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const csvText: string = body.csvText ?? "";
  const accountId: string = body.accountId ?? "";
  const map: ColumnMap | undefined = body.map;

  if (!accountId) return NextResponse.json({ error: "Pick an account first" }, { status: 400 });

  const existing = await db.bankTxn.findMany({ where: { accountId }, select: { importHash: true } });
  const existingHashes = new Set(existing.map((e) => e.importHash));

  const result = buildImport(csvText, accountId, existingHashes, map);
  return NextResponse.json(result);
}
