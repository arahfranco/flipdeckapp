import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import nodemailer from "nodemailer";
import { db } from "./lib/db";

const smtpConfigured = Boolean(process.env.EMAIL_SERVER_HOST);

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

        if (!smtpConfigured) {
          console.log(`\n[dev] Sign-in link for ${identifier}:\n${url}\n`);
          return;
        }
        const transport = nodemailer.createTransport({
          host: process.env.EMAIL_SERVER_HOST,
          port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
          auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD },
        });
        await transport.sendMail({
          to: identifier,
          from: process.env.EMAIL_FROM,
          subject: "Sign in to Flipdeck",
          text: `Sign in to Flipdeck: ${url}`,
          html: `<p><a href="${url}">Sign in to Flipdeck</a></p>`,
        });
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
