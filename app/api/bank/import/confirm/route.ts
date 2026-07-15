import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { buildImport, importHash, type ColumnMap } from "@/lib/csvImport";

export async function POST(req: Request) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const csvText: string = body.csvText ?? "";
  const map: ColumnMap | undefined = body.map;
  const account: string = typeof body.account === "string" ? body.account.trim() : "";
  if (!account) return NextResponse.json({ error: "Account name is required" }, { status: 400 });

  const existing = await db.bankTxn.findMany({ select: { importHash: true } });
  const existingHashes = new Set(existing.map((e) => e.importHash));

  const result = buildImport(csvText, existingHashes, map);
  if (result.needsMapping || result.error) {
    return NextResponse.json({ error: "Could not parse this file — request a preview first" }, { status: 400 });
  }

  const fresh = result.items.filter((i) => i.status === "fresh");
  const created = await db.bankTxn.createMany({
    data: fresh.map((i) => ({
      date: new Date(i.date!),
      description: i.description!,
      amount: i.amount!,
      account,
      importHash: importHash(i.date!, i.amount!, i.description!),
    })),
    skipDuplicates: true, // DB-level backstop on the importHash unique constraint
  });

  return NextResponse.json({ imported: created.count });
}
