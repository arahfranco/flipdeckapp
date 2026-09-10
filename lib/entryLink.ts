import { randomBytes } from "crypto";
import { db } from "./db";

// The shared, no-login expense-entry link. A single unguessable token lives on
// the Company row; the link only works while entryEnabled is true. Rotating the
// token invalidates any link already shared.

/** URL-safe, ~32 chars of entropy. */
export function generateEntryToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The Company behind a live entry token, or null when missing/disabled/unknown.
 *  A blank token never matches (findFirst on entryToken: "" would be wrong). */
export async function resolveEntryCompany(token: string) {
  if (!token) return null;
  const company = await db.company.findFirst({ where: { entryToken: token, entryEnabled: true } });
  return company ?? null;
}
