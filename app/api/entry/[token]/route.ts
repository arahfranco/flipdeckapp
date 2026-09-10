import { NextResponse } from "next/server";
import { ExpenseStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { ALL_SUBS, EXPENSE_STATUS_LABELS } from "@/lib/constants";
import { resolveEntryCompany } from "@/lib/entryLink";
import { sendMail } from "@/lib/mailer";

// Public, token-gated expense submission for the field team — NO login. The
// unguessable token in the path is the only gate; the Owner can disable or
// rotate it from Company Settings. Everything is validated here, not trusted.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const company = await resolveEntryCompany(params.token);
  if (!company) {
    return NextResponse.json({ error: "This entry link is no longer active." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Amount: a finite positive number, with a sane ceiling to blunt abuse.
  const amount = Number(body.amount);
  if (!isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  // Subcategory must be one of the real expense subcategories (Selling Price is
  // revenue, not importable).
  const validSubs = new Set(ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub));
  const subcategory = String(body.subcategory ?? "");
  if (!validSubs.has(subcategory)) {
    return NextResponse.json({ error: "Pick a category." }, { status: 400 });
  }

  // Status defaults to Pending; anything unexpected is coerced to it.
  const status = Object.values(ExpenseStatus).includes(body.status) ? (body.status as ExpenseStatus) : "PENDING";

  // Date is optional — a blank one is fine and gets filled later in the log.
  let date: Date | null = null;
  if (body.date) {
    const d = new Date(String(body.date));
    if (!isNaN(d.getTime())) date = d;
  }

  // A real property, or general/overhead when blank.
  let propertyId: string | null = body.propertyId ? String(body.propertyId) : null;
  let propertyLabel = "General / overhead";
  if (propertyId) {
    const property = await db.property.findUnique({ where: { id: propertyId }, select: { id: true, address: true } });
    if (property) propertyLabel = property.address;
    else propertyId = null;
  }

  const description = String(body.description ?? "").trim().slice(0, 300) || subcategory;
  // Optional, notification-only — who filled the form. Not stored on the expense.
  const submittedBy = String(body.submittedBy ?? "").trim().slice(0, 80);
  const receiptUrl = body.receiptUrl ? String(body.receiptUrl) : null;

  await db.expense.create({
    data: { propertyId, date, amount, description, subcategory, status, receiptUrl },
  });

  // Notify the Owner(s) — best-effort, never blocks or fails the submission.
  try {
    await notifyOwners({ submittedBy, propertyLabel, amount, description, subcategory, status, date, receiptUrl, appName: company.appName });
  } catch (e) {
    console.error("Entry-link notification failed", e);
  }

  return NextResponse.json({ ok: true });
}

async function notifyOwners(x: {
  submittedBy: string;
  propertyLabel: string;
  amount: number;
  description: string;
  subcategory: string;
  status: ExpenseStatus;
  date: Date | null;
  receiptUrl: string | null;
  appName: string;
}) {
  const owners = await db.user.findMany({ where: { role: Role.OWNER }, select: { email: true } });
  const to = owners.map((o) => o.email).filter((e): e is string => Boolean(e));
  if (to.length === 0) return;

  const who = x.submittedBy || "Someone";
  const money = `$${x.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const when = x.date ? x.date.toISOString().slice(0, 10) : "no date given";
  const subject = `New expense: ${money} — ${x.description}`;

  const lines = [
    `${who} logged an expense through the team entry link.`,
    ``,
    `Amount:      ${money}`,
    `For:         ${x.description}`,
    `Category:    ${x.subcategory}`,
    `Property:    ${x.propertyLabel}`,
    `Date:        ${when}`,
    `Status:      ${EXPENSE_STATUS_LABELS[x.status]}`,
    `Receipt:     ${x.receiptUrl ? x.receiptUrl : "none attached"}`,
    ``,
    `It's in the ${x.appName} expense log for review.`,
  ];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<p><strong>${esc(who)}</strong> logged an expense through the team entry link.</p>` +
    `<table cellpadding="4" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">` +
    `<tr><td><strong>Amount</strong></td><td>${money}</td></tr>` +
    `<tr><td><strong>For</strong></td><td>${esc(x.description)}</td></tr>` +
    `<tr><td><strong>Category</strong></td><td>${esc(x.subcategory)}</td></tr>` +
    `<tr><td><strong>Property</strong></td><td>${esc(x.propertyLabel)}</td></tr>` +
    `<tr><td><strong>Date</strong></td><td>${when}</td></tr>` +
    `<tr><td><strong>Status</strong></td><td>${EXPENSE_STATUS_LABELS[x.status]}</td></tr>` +
    `<tr><td><strong>Receipt</strong></td><td>${x.receiptUrl ? `<a href="${esc(x.receiptUrl)}">view</a>` : "none attached"}</td></tr>` +
    `</table>` +
    `<p>It's in the ${esc(x.appName)} expense log for review.</p>`;

  await sendMail({ to, subject, text: lines.join("\n"), html });
}
