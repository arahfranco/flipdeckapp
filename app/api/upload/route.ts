import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAccess, requireRole } from "@/lib/authz";
import { putObject } from "@/lib/r2";
import { env, missingEnv } from "@/lib/env";

// Receives the file itself and forwards it to R2, so the browser only ever
// talks to this app. See lib/r2.ts putObject() for why this beats handing the
// browser a presigned URL to Cloudflare.
//
// "receipt" is gated the same as the Expenses section (a receipt is meaningless
// without expense-log access); "logo" is Owner-only, matching Company Settings
// (spec §5); "property-photo" matches Properties section access.
const KIND_TO_FOLDER = { receipt: "receipts", logo: "logos", "property-photo": "properties" } as const;

// Serverless caps the request body at 4.5 MB. Reject at 4 MB with a message
// that says what to do, rather than letting the platform return an opaque 413.
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected a file upload" }, { status: 400 });

  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

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

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 4 MB.` },
      { status: 413 }
    );
  }

  // All five are needed. Checking only two let a half-configured deployment
  // past this point and fail later with an opaque signing error instead.
  // Names only — never echo the values back to the client.
  const missing = missingEnv([
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ]);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `File storage is not configured — missing ${missing.join(", ")}` },
      { status: 503 }
    );
  }

  // A present-but-malformed value is worse than a missing one: it passes the
  // check above, then fails deep inside the S3 client with an opaque error.
  const accountId = env("R2_ACCOUNT_ID");
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    return NextResponse.json(
      { error: `R2_ACCOUNT_ID is malformed (${accountId.length} chars) — expected 32 hex characters, no quotes` },
      { status: 503 }
    );
  }
  if (!/^https?:\/\//.test(env("R2_PUBLIC_URL"))) {
    return NextResponse.json(
      { error: "R2_PUBLIC_URL is malformed — expected it to start with https://, no quotes" },
      { status: 503 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await putObject(KIND_TO_FOLDER[kind as keyof typeof KIND_TO_FOLDER], file.type, buffer);
    return NextResponse.json({ publicUrl });
  } catch (e) {
    console.error("Upload to R2 failed", e);

    // R2 rejecting the signature says the credentials this deployment is using
    // differ from the ones that work elsewhere — but the message alone can't
    // say how. Report the shape of each value (never the value) so a truncated
    // or swapped key is identifiable without exposing a secret. The caller is
    // already an authenticated staff user by this point.
    const shape = (name: string) => {
      const v = env(name);
      return `${v.length}c${/^[A-Za-z0-9]+$/.test(v) ? "" : "/nonalnum"}`;
    };

    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Upload failed",
        diagnostic: {
          name: e instanceof Error ? e.name : "unknown",
          host: `${accountId}.r2.cloudflarestorage.com`,
          bucket: env("R2_BUCKET_NAME"),
          keyId: shape("R2_ACCESS_KEY_ID"),
          secret: shape("R2_SECRET_ACCESS_KEY"),
        },
      },
      { status: 502 }
    );
  }
}
