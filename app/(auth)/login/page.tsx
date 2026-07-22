import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; sent?: string };
}) {
  // Clicking the magic link creates the session, then NextAuth redirects
  // back here. Without this check the sign-in form just re-renders and it
  // looks like sign-in failed — even though the user IS authenticated.
  const session = await auth();
  if (session?.user) redirect("/");

  const company = await db.company.findFirst();
  const appName = company?.appName ?? "Flipdeck";
  const subtitle = `${company?.name ?? "Flipdeck"}${company?.tagline ? ` — ${company.tagline}` : ""}`;

  // After a successful send we redirect here with ?sent=1 and show a clear
  // "check your email" confirmation, rather than bouncing to "/" (which has
  // no session yet and would just loop back to the login form).
  if (searchParams.sent) {
    return (
      <div className="fd-login">
        <div className="fd-login-card">
          <h1>{appName}</h1>
          <p>{subtitle}</p>
          <p className="ok" style={{ marginTop: 18 }}>
            Check your email for a sign-in link.
          </p>
          <p className="hint" style={{ marginTop: 10 }}>
            It should arrive within a minute. Didn&apos;t get it? Check spam, or{" "}
            <a href="/login" className="linkish">
              try again
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fd-login">
      <div className="fd-login-card">
        <h1>{appName}</h1>
        <p>{subtitle}</p>

        <form
          action={async (formData: FormData) => {
            "use server";
            const email = String(formData.get("email") ?? "");
            let ok = true;
            try {
              // redirect:false so signIn sends the email and returns instead of
              // throwing its own redirect — lets us control where the user lands
              // right now. redirectTo is a different thing: it's the callbackUrl
              // baked into the emailed link, i.e. where they land AFTER clicking.
              await signIn("email", { email, redirectTo: "/", redirect: false });
            } catch {
              ok = false;
            }
            // Always land on the "sent" confirmation on success — even for an
            // unregistered email (which sends nothing) — so the page never
            // reveals which addresses have accounts.
            redirect(ok ? "/login?sent=1" : "/login?error=1");
          }}
        >
          <div className="fld">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="you@foundationalrealestate.co" />
          </div>
          {searchParams.error && <p className="err">Sign-in failed. Please try again.</p>}
          <button type="submit" className="fd-btn" style={{ width: "100%", justifyContent: "center" }}>
            Send sign-in link
          </button>
        </form>
      </div>
    </div>
  );
}
