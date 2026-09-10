import { normDate } from "./csvImport";

// Free, local "smart add": turn pasted free text into the same template CSV the
// bulk importer already understands — no API, no cost. One line = one expense.
// Every guess is a suggestion the user reviews in the import preview before
// anything is saved, so imperfect mapping is fine.

// Keyword -> a REAL subcategory from lib/constants (SUBS_BY_CAT). First hit wins,
// so the order is specific-trade before generic materials/labor. NOTE: this is a
// separate map from csvImport.guessCategory, whose labels don't match the app's
// actual subcategories.
const GUESS: [RegExp, string][] = [
  [/closing costs?/i, "Closing Costs"],
  [/transfer tax/i, "Transfer Tax"],
  [/purchase price|down ?payment|earnest/i, "Purchase Price"],
  [/escrow fees?/i, "Escrow Fees"],
  [/title|escrow/i, "Title & Escrow"],
  [/apprais/i, "Appraisal"],
  [/inspect/i, "Inspection"],

  [/dumpster|debris|\bhaul|junk|site ?prep|demo(lition)?|grading|clean ?up/i, "Demolition and Site Prep"],
  [/roof|shingle/i, "Roofing"],
  [/siding|stucco|exterior wall/i, "Exterior Walls and Siding"],
  [/frami?ng|truss/i, "Framing"],
  [/hvac|furnace|air ?condition|heat ?pump|\ba\/?c\b|ductwork|\bduct\b/i, "HVAC"],
  [/plumb|repipe|\bpex\b|faucet|water heater|sewer|drain|\bpipe/i, "Plumbing"],
  [/electric|rewire|wiring|outlet|breaker|\bpanel\b/i, "Electrical"],
  [/insulat/i, "Insulation"],
  [/drywall|sheetrock|plaster|interior wall/i, "Interior Walls and Drywall"],
  [/floor|carpet|hardwood|laminate|vinyl|\btile|grout/i, "Flooring"],
  [/kitchen|cabinet|counter ?top|quartz|granite/i, "Kitchen Remodel"],
  [/bath(room)?|vanit|toilet|shower|\btub\b/i, "Bathroom Remodels"],
  [/\bdoor|\btrim\b|mold(ing)?|moulding|millwork|baseboard|casing/i, "Interior Doors and Millwork"],
  [/appliance|fridge|refrigerator|stove|\boven|dishwasher|microwave|\blight|\blamp|fixture|chandelier/i, "Fixtures and Appliances"],
  [/landscap|\blawn|garden|\bsod\b|mulch|\btree|fence|fencing|irrigation|sprinkler/i, "Landscaping"],

  [/property tax|prop tax|tax collector|treasurer/i, "Property Tax"],
  [/insur/i, "Insurance"],
  [/\bhoa\b|homeowners assoc|association due/i, "HOA Dues"],
  [/interest|loan ?pmt|loan payment|mortgage/i, "Loan Interest"],
  [/utilit|water bill|sewer bill|gas bill|power bill|electric bill|internet|pg&e/i, "Utilities"],
  [/security|alarm|camera|monitoring|maintenance/i, "Security & Maintenance"],

  [/listing (commission|agent)/i, "Listing Commission"],
  [/buyer'?s? (commission|agent)/i, "Buyer Commission"],
  [/stag(e|ing)/i, "Staging"],
  [/photo/i, "Photography"],
  [/concession/i, "Seller Concessions"],

  [/permit|license|city of|county of/i, "Miscellaneous and Permits"],

  // Generic materials / labor last, so specific trades above win first.
  [/material|lumber|\bwood\b|home ?depot|lowe'?s|menards|ace hardware|hardware|supplies|nails|screws|paint|concrete|cement/i, "Building Materials"],
  [/labou?r|\bcrew\b|worker|handyman|contractor|helper/i, "Labor"],
];

const FALLBACK_SUB = "Miscellaneous and Permits";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Best-effort subcategory for one line, restricted to the valid set. */
function guessSub(line: string, valid: string[]): string {
  // A category typed verbatim (whole-word) wins outright.
  for (const sub of valid) {
    if (new RegExp(`\\b${escapeRe(sub)}\\b`, "i").test(line)) return sub;
  }
  const validSet = new Set(valid);
  for (const [re, sub] of GUESS) {
    if (re.test(line) && validSet.has(sub)) return sub;
  }
  return validSet.has(FALLBACK_SUB) ? FALLBACK_SUB : valid[0] ?? FALLBACK_SUB;
}

function csvField(v: string): string {
  if (v === "") return "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

interface SmartRow {
  date: string;
  sub: string;
  amount: string;
  description: string;
  status: string;
}

function parseLine(line: string, valid: string[]): SmartRow {
  let work = ` ${line} `;

  // Date: ISO first, then M/D or M/D/Y (adding the current year when absent).
  let date = "";
  const iso = work.match(/\b\d{4}-\d{1,2}-\d{1,2}\b/);
  if (iso) {
    date = normDate(iso[0]);
    work = work.replace(iso[0], " ");
  } else {
    const us = work.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (us) {
      const full = us[3] ? us[0] : `${us[1]}/${us[2]}/${new Date().getFullYear()}`;
      date = normDate(full);
      work = work.replace(us[0], " ");
    }
  }

  // Amount: a $-prefixed number wins; otherwise the largest bare number left.
  let amount = "";
  const dollar = work.match(/\$\s?(\d[\d,]*(?:\.\d+)?)/);
  if (dollar) {
    amount = dollar[1].replace(/,/g, "");
    work = work.replace(dollar[0], " ");
  } else {
    let best = "";
    let bestVal = 0;
    for (const m of work.matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g)) {
      const v = parseFloat(m[0].replace(/,/g, ""));
      if (!isNaN(v) && v > bestVal) {
        bestVal = v;
        best = m[0];
      }
    }
    if (best) {
      amount = best.replace(/,/g, "");
      work = work.replace(best, " ");
    }
  }

  // Status keywords, removed from what's left for the description.
  let status = "Pending";
  if (/reimburs/i.test(work)) {
    status = "Reimbursed";
    work = work.replace(/reimburse?d?/gi, " ");
  } else if (/\bpaid\b/i.test(work)) {
    status = "Paid";
    work = work.replace(/\bpaid\b/gi, " ");
  }
  work = work.replace(/\bpending\b/gi, " ");

  const sub = guessSub(line, valid);
  let description = work.replace(/\s+/g, " ").replace(/^[\s,;:.–-]+|[\s,;:.–-]+$/g, "").trim();
  if (!description) description = sub;

  return { date, sub, amount, description, status };
}

/** Convert pasted text into template CSV (Date,Subcategory,Amount,Description,Status). */
export function parseSmartText(text: string, validSubcategories: string[]): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = ["Date,Subcategory,Amount,Description,Status"];
  for (const line of lines) {
    const r = parseLine(line, validSubcategories);
    out.push([csvField(r.date), csvField(r.sub), csvField(r.amount), csvField(r.description), csvField(r.status)].join(","));
  }
  return out.join("\r\n");
}
