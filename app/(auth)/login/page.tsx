import { signIn } from "@/auth";
import { db } from "@/lib/db";

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const company = await db.company.findFirst();

  return (
    <div className="fd-login">
      <div className="fd-login-card">
        <h1>{company?.appName ?? "Flipdeck"}</h1>
        <p>
          {company?.name ?? "Foundational Real Estate"}
          {company?.tagline ? ` — ${company.tagline}` : ""}
        </p>

        <form
          action={async (formData: FormData) => {
            "use server";
            const email = String(formData.get("email") ?? "");
            // Sends the magic link and redirects to NextAuth's built-in
            // /api/auth/verify-request page — no custom "check your email" state needed.
            await signIn("email", { email, redirectTo: "/" });
          }}
        >
          <div className="fld">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="you@foundationalrealestate.co" />
          </div>
          {searchParams.error && <p className="err">Sign-in failed. Try again.</p>}
          <button type="submit" className="fd-btn" style={{ width: "100%", justifyContent: "center" }}>
            Send sign-in link
          </button>
        </form>
      </div>
    </div>
  );
}
