import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { buildImport, type ColumnMap } from "@/lib/csvImport";

// Preview only — does not touch the database. §6d: duplicate detection keys
// on date|amount|normalized-description, checked against BankTxn.importHash.
export async function POST(req: Request) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const csvText: string = body.csvText ?? "";
  const map: ColumnMap | undefined = body.map;

  const existing = await db.bankTxn.findMany({ select: { importHash: true } });
  const existingHashes = new Set(existing.map((e) => e.importHash));

  const result = buildImport(csvText, existingHashes, map);
  return NextResponse.json(result);
}
