import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAccess } from "@/lib/authz";
import { ALL_SUBS } from "@/lib/constants";

// Turns pasted free text (a list, an email, notes off a receipt) into the same
// CSV the bulk importer already understands — so the AI only does the mapping,
// and the existing preview lets the user review it before anything is created.
// Nothing is written to the database here.

const FALLBACK_SUB = "Miscellaneous and Permits";

export async function POST(req: Request) {
  const guard = await requireAccess("expenses");
  if ("error" in guard) return guard.error;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI parsing isn't set up yet — add ANTHROPIC_API_KEY to the server environment." },
      { status: 503 },
    );
  }

  const { text } = await req.json();
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Paste some text first." }, { status: 400 });
  }

  const validSubcats = ALL_SUBS.filter((s) => s.cat !== "Selling Price").map((s) => s.sub);
  const today = new Date().toISOString().slice(0, 10);

  const system = [
    "You convert messy expense notes into a strict CSV for a house-flipping expense tracker.",
    "",
    "Output ONLY CSV — no prose, no explanation, no code fences. The first line must be exactly this header:",
    "Date,Subcategory,Amount,Description,Status",
    "Then one line per expense.",
    "",
    "Rules for each column:",
    `- Date: YYYY-MM-DD. Today is ${today}; resolve relative dates ("yesterday", "8/14") against it, using the current year when a year is missing. If a row has NO date, leave the Date cell EMPTY — never invent one.`,
    `- Subcategory: MUST be copied verbatim from this allowed list. Pick the closest fit; if nothing fits, use "${FALLBACK_SUB}". Allowed list:`,
    validSubcats.map((s) => `    ${s}`).join("\n"),
    "- Amount: a positive number only, no $ or thousands commas (e.g. 1250.50).",
    '- Description: a short label. If it contains a comma, wrap the whole field in double quotes.',
    "- Status: one of Pending, Paid, Reimbursed. Use Paid only if the text clearly says it was paid; otherwise Pending.",
    "",
    "Split combined lines (e.g. two items in one sentence) into separate rows. Skip anything that isn't an expense.",
  ].join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
      max_tokens: 4000,
      output_config: { effort: "low" }, // simple extraction — keep it fast and cheap
      system,
      messages: [{ role: "user", content: text }],
    });

    let csv = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Defensively strip a ```csv ... ``` fence if the model added one.
    csv = csv.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();

    if (!/^date\s*,/i.test(csv)) {
      return NextResponse.json(
        { error: "The AI couldn't turn that into expenses. Try adding amounts, or use the CSV template instead." },
        { status: 422 },
      );
    }

    return NextResponse.json({ csv });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "The AI key was rejected — check ANTHROPIC_API_KEY." }, { status: 502 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "AI is rate-limited right now — try again in a moment." }, { status: 429 });
    }
    return NextResponse.json({ error: "AI parsing failed. Try again, or use the CSV template." }, { status: 502 });
  }
}
