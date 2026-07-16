import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import nodemailer from "nodemailer";
import { db } from "./lib/db";

// Env values pasted into a hosting dashboard sometimes keep the surrounding
// quotes from a .env line (the quirk that broke DATABASE_URL on Vercel).
// Strip them so a quoted "re_…" key still matches the Resend check below
// instead of silently falling through to the SMTP path (which fails on
// serverless). Defensive — harmless when there are no quotes.
const env = (name: string) => (process.env[name] ?? "").replace(/^\s*["']|["']\s*$/g, "").trim();

const smtpConfigured = Boolean(env("EMAIL_SERVER_HOST"));

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  providers: [
    Email({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      // No SMTP configured yet (see .env) — print the magic link to the
      // server console instead of failing with ECONNREFUSED. Once
      // EMAIL_SERVER_HOST is set this branch never runs; real mail goes out
      // through nodemailer exactly as NextAuth's Email provider normally does.
      async sendVerificationRequest({ identifier, url }) {
        // Invite-only: this is an internal tool holding partner capital and
        // payroll, not a self-serve product — only emails an Owner has
        // already created a User row for may sign in. Checking here (rather
        // than in a signIn callback) matters because the Email provider's
        // built-in flow calls adapter.createUser() for an unknown address
        // BEFORE any signIn callback would run, and User.name is required —
        // that mismatch is what crashed with "Argument `name` is missing."
        // We also don't distinguish this case in the UI (still shows the
        // generic "check your email" page) to avoid leaking which emails
        // have accounts.
        const existing = await db.user.findUnique({ where: { email: identifier } });
        if (!existing) {
          console.warn(`[auth] Sign-in attempted for unregistered email: ${identifier}`);
          return;
        }

        const from = env("EMAIL_FROM") || "Flipdeck <onboarding@resend.dev>";
        const subject = "Sign in to Flipdeck";
        const text = `Sign in to Flipdeck:\n${url}\n`;
        const html = `<p>Click to sign in to Flipdeck:</p><p><a href="${url}">Sign in</a></p><p>Or paste this link into your browser:</p><p>${url}</p>`;
        const apiKey = env("EMAIL_SERVER_PASSWORD");
        const host = env("EMAIL_SERVER_HOST");

        // Resend: send over their HTTPS API, NOT SMTP. nodemailer SMTP is
        // unreliable on Vercel's serverless functions — the outbound
        // connection times out / is blocked, which surfaces as NextAuth's
        // "Server error / problem with the server configuration" page. A
        // plain fetch over HTTPS avoids that entirely (Resend's own
        // recommendation for serverless). Detect Resend by the key prefix or
        // the SMTP host, so a Resend setup always takes this path.
        if (apiKey.startsWith("re_") || host.includes("resend")) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: identifier, subject, html, text }),
          });
          if (!res.ok) {
            throw new Error(`Resend API ${res.status}: ${await res.text()}`);
          }
          return;
        }

        // No provider configured (local dev) — print the link to the console.
        if (!smtpConfigured) {
          console.log(`\n[dev] Sign-in link for ${identifier}:\n${url}\n`);
          return;
        }

        // Generic SMTP (nodemailer) for any non-Resend provider.
        const transport = nodemailer.createTransport({
          host,
          port: Number(env("EMAIL_SERVER_PORT") || 587),
          auth: { user: env("EMAIL_SERVER_USER"), pass: apiKey },
        });
        await transport.sendMail({ to: identifier, from, subject, text, html });
      },
    }),
  ],
  callbacks: {
    // database session strategy hands us the full Prisma User row here —
    // carry the fields the authorization layer (lib/authz.ts) needs onto the session.
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.partnerId = user.partnerId;
      return session;
    },
  },
});
