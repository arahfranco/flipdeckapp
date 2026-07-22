import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAccess, requireRole } from "@/lib/authz";
import { createUploadUrl } from "@/lib/r2";

// Returns a presigned R2 upload URL. "receipt" is gated the same as the
// Expenses section (a receipt is meaningless without expense-log access);
// "logo" is Owner-only, matching Company Settings (spec §5); "property-photo"
// matches Properties section access.
const KIND_TO_FOLDER = { receipt: "receipts", logo: "logos", "property-photo": "properties" } as const;

export async function POST(req: Request) {
  const body = await req.json();
  const { kind, contentType } = body;

  if (kind === "receipt") {
    const guard = await requireAccess("expenses");
    if ("error" in guard) return guard.error;
  } else if (kind === "logo") {
    const guard = await requireRole(Role.OWNER);
    if ("error" in guard) return guard.error;
  } else if (kind === "property-photo") {
    const guard = await requireAccess("properties");
    if ("error" in guard) return guard.error;
  } else {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  // All five are needed. Checking only two let a half-configured deployment
  // past this point and fail later with an opaque signing error instead.
  // Names only — never echo the values back to the client.
  const missing = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ].filter((k) => !(process.env[k] ?? "").trim());

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `File storage is not configured — missing ${missing.join(", ")}` },
      { status: 503 }
    );
  }

  try {
    const { uploadUrl, publicUrl } = await createUploadUrl(KIND_TO_FOLDER[kind as keyof typeof KIND_TO_FOLDER], contentType);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload setup failed" }, { status: 400 });
  }
}
