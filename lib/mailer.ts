import nodemailer from "nodemailer";
import { env } from "./env";

// Small reusable mailer, mirroring the send logic in auth.ts: Resend over HTTPS
// (reliable on serverless), generic SMTP otherwise, and a console fallback in
// local dev so nothing throws when mail isn't configured. Callers should treat
// sending as best-effort — wrap in try/catch so a mail failure never breaks the
// primary action.

interface MailOpts {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail({ to, subject, text, html }: MailOpts): Promise<void> {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return;

  const from = env("EMAIL_FROM") || "Flipdeck <onboarding@resend.dev>";
  const apiKey = env("EMAIL_SERVER_PASSWORD");
  const host = env("EMAIL_SERVER_HOST");

  // Resend HTTPS API — accepts an array of recipients.
  if (apiKey.startsWith("re_") || host.includes("resend")) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipients, subject, html: html ?? text, text }),
    });
    if (!res.ok) throw new Error(`Resend API ${res.status}: ${await res.text()}`);
    return;
  }

  // No provider configured (local dev) — log instead of failing.
  if (!host) {
    console.log(`\n[dev] Email → ${recipients.join(", ")}\nSubject: ${subject}\n${text}\n`);
    return;
  }

  // Generic SMTP.
  const transport = nodemailer.createTransport({
    host,
    port: Number(env("EMAIL_SERVER_PORT") || 587),
    auth: { user: env("EMAIL_SERVER_USER"), pass: apiKey },
  });
  await transport.sendMail({ to: recipients.join(", "), from, subject, text, html });
}
