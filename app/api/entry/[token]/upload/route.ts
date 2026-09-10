import { NextResponse } from "next/server";
import { putObject } from "@/lib/r2";
import { env, missingEnv } from "@/lib/env";
import { resolveEntryCompany } from "@/lib/entryLink";

// Token-gated receipt upload for the public entry page. Same R2 forwarding as
// /api/upload, but gated on the entry token instead of a login. Always stores
// under "receipts".
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const company = await resolveEntryCompany(params.token);
  if (!company) return NextResponse.json({ error: "This entry link is no longer active." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected a file upload" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "That file is empty" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 4 MB.` },
      { status: 413 },
    );
  }

  const missing = missingEnv([
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ]);
  if (missing.length > 0) {
    return NextResponse.json({ error: "Photo storage isn't set up yet — you can still submit without a photo." }, { status: 503 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await putObject("receipts", file.type, buffer);
    return NextResponse.json({ publicUrl });
  } catch {
    return NextResponse.json({ error: "Photo upload failed — you can still submit without it." }, { status: 502 });
  }
}
