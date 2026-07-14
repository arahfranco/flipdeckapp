import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAccess, requireRole } from "@/lib/authz";
import { createUploadUrl } from "@/lib/r2";

// Returns a presigned R2 upload URL. "receipt" is gated the same as the
// Expenses section (a receipt is meaningless without expense-log access);
// "logo" is Owner-only, matching Company Settings (spec §5).
export async function POST(req: Request) {
  const body = await req.json();
  const { kind, contentType } = body;

  if (kind === "receipt") {
    const guard = await requireAccess("expenses");
    if ("error" in guard) return guard.error;
  } else if (kind === "logo") {
    const guard = await requireRole(Role.OWNER);
    if ("error" in guard) return guard.error;
  } else {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
    return NextResponse.json({ error: "File storage is not configured yet" }, { status: 503 });
  }

  try {
    const { uploadUrl, publicUrl } = await createUploadUrl(kind === "receipt" ? "receipts" : "logos", contentType);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload setup failed" }, { status: 400 });
  }
}
