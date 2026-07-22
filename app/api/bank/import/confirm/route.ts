import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { buildImport, importHash, type ColumnMap } from "@/lib/csvImport";

export async function POST(req: Request) {
  const guard = await requireAccess("bank");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const csvText: string = body.csvText ?? "";
  const accountId: string = body.accountId ?? "";
  const map: ColumnMap | undefined = body.map;

  if (!accountId) return NextResponse.json({ error: "Pick an account first" }, { status: 400 });
  const account = await db.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const existing = await db.bankTxn.findMany({ where: { accountId }, select: { importHash: true } });
  const existingHashes = new Set(existing.map((e) => e.importHash));

  const result = buildImport(csvText, accountId, existingHashes, map);
  if (result.needsMapping || result.error) {
    return NextResponse.json({ error: "Could not parse this file — request a preview first" }, { status: 400 });
  }

  const fresh = result.items.filter((i) => i.status === "fresh");
  const created = await db.bankTxn.createMany({
    data: fresh.map((i) => ({
      date: new Date(i.date!),
      description: i.description!,
      amount: i.amount!,
      direction: i.direction!,
      accountId,
      importHash: importHash(accountId, i.date!, i.amount!, i.direction!, i.description!),
    })),
    skipDuplicates: true, // DB-level backstop on the importHash unique constraint
  });

  return NextResponse.json({
    imported: created.count,
    moneyIn: fresh.filter((i) => i.direction === "IN").length,
    moneyOut: fresh.filter((i) => i.direction === "OUT").length,
  });
}
