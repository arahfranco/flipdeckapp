import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const guard = await requireAccess("expenses");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { propertyId, date, amount, description, subcategory, status, receiptUrl } = body;
  if (!propertyId || !date || amount == null || !description || !subcategory) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const expense = await db.expense.create({
    data: {
      propertyId,
      date: new Date(date),
      amount,
      description,
      subcategory,
      status: status ?? "PENDING",
      receiptUrl: receiptUrl || null,
    },
  });
  return NextResponse.json(expense, { status: 201 });
}
