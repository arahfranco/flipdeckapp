import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// TEMPORARY diagnostic — remove once the sign-in email issue is resolved.
// Reports which commit is actually live and which mail path the deployed
// code would take, because the app reports "sent" while never reaching
// Resend and there's no other way to introspect the running deployment.
// Token-gated (NEXTAUTH_SECRET) and deliberately leaks no secret values:
// only presence + a 3-char prefix, never the key itself.
const env = (name: string) => (process.env[name] ?? "").replace(/^\s*["']|["']\s*$/g, "").trim();

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const secret = env("NEXTAUTH_SECRET") || env("AUTH_SECRET");
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = env("EMAIL_SERVER_PASSWORD");
  const host = env("EMAIL_SERVER_HOST");
  const mailPath =
    apiKey.startsWith("re_") || host.includes("resend") ? "resend-api" : host ? "smtp" : "console-only";

  let userEmails: string[] = [];
  let dbError: string | null = null;
  try {
    userEmails = (await db.user.findMany({ select: { email: true } })).map((u) => u.email);
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  // ?send=you@example.com performs a real Resend call using the DEPLOYED
  // env vars and returns the raw status/body — the only way to see why a
  // send fails without access to the runtime logs.
  const sendTo = new URL(req.url).searchParams.get("send");
  let sendResult: unknown = null;
  if (sendTo) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env("EMAIL_FROM") || "Flipdeck <onboarding@resend.dev>",
          to: sendTo,
          subject: "Flipdeck diagnostic send",
          text: "Diagnostic send from the deployed app using its own env vars.",
        }),
      });
      sendResult = { status: r.status, body: (await r.text()).slice(0, 400) };
    } catch (e) {
      sendResult = { threw: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    // Vercel injects these — tells us exactly which commit is running.
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 7),
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "unknown",
    mailPath,
    emailFrom: env("EMAIL_FROM"),
    emailHost: host,
    emailPort: env("EMAIL_SERVER_PORT"),
    emailUser: env("EMAIL_SERVER_USER"),
    apiKeyPresent: apiKey.length > 0,
    apiKeyPrefix: apiKey.slice(0, 3),
    apiKeyLength: apiKey.length,
    hasAuthSecret: env("AUTH_SECRET").length > 0,
    hasNextAuthSecret: env("NEXTAUTH_SECRET").length > 0,
    nextAuthUrl: env("NEXTAUTH_URL"),
    userEmails,
    dbError,
    sendResult,
  });
}
