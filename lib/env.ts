/**
 * Reads an environment variable, tolerating surrounding quotes.
 *
 * `.env` files strip quotes when parsed, so `KEY="value"` works locally. Values
 * pasted into a hosting dashboard are stored literally, quotes and all — and a
 * quoted value is rarely *empty*, so presence checks pass and the damage shows
 * up much later as something unrelated: a hostname that won't resolve, a URL
 * that fails protocol validation, an API key that doesn't match its prefix.
 *
 * This project has hit that three times (DATABASE_URL, the Resend key, and the
 * R2 credentials), so reading env vars goes through here.
 */
export function env(name: string): string {
  return (process.env[name] ?? "").replace(/^\s*["']|["']\s*$/g, "").trim();
}

/** Names of any listed variables that are missing or blank once trimmed. */
export function missingEnv(names: string[]): string[] {
  return names.filter((n) => !env(n));
}
