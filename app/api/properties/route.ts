import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { Status } from "@prisma/client";
import { CATEGORIES, SUBS_BY_CAT, type Category } from "@/lib/constants";

export async function POST(req: Request) {
  const guard = await requireAccess("properties");
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { address, mls, type, beds, baths, sqft, lotSize, stories, photoUrl } = body;
  if (!address || !type || beds == null || baths == null || sqft == null || lotSize == null || stories == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Pre-populate the full standard budget checklist (every subcategory across
  // the 5 categories, $0/$0) so the Budget tab is immediately editable —
  // there's no separate "add budget line" flow, budget lines are edited in
  // place via BudgetLineRow.
  const budgetLines = (CATEGORIES as readonly Category[]).flatMap((cat) =>
    SUBS_BY_CAT[cat].map((sub) => ({ category: cat, subcategory: sub, estimated: 0, actual: 0 }))
  );

  const property = await db.property.create({
    data: {
      address,
      mls: mls || null,
      type,
      beds: Number(beds),
      baths: Number(baths),
      sqft: Number(sqft),
      lotSize: Number(lotSize),
      stories: Number(stories),
      status: Status.SCOUTING,
      photoUrl: photoUrl || null,
      budget: { create: budgetLines },
    },
  });

  return NextResponse.json(property, { status: 201 });
}
