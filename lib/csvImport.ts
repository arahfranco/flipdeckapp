// Ported from the prototype (index.html, recovered from git history — see
// commit 635b000~1). These functions and their comments are the tested spec
// for bank CSV import (build-handoff doc §6) — do not "simplify" the
// precedence rules, each one exists because of a real bug that was caught.

export type ColumnMap = {
  date: number | null;
  desc: number | null;
  amount: number | null;
  debit: number | null;
  credit: number | null;
};

/** RFC4180-ish parser: handles quoted fields, embedded commas/newlines,
 * escaped "" quotes, and Excel-added BOMs. Splitting on "," alone breaks on
 * real bank data ("HOME DEPOT #6832, FREMONT CA"). */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i += 2;
          continue;
        }
        q = false;
        i++;
        continue;
      }
      f += c;
      i++;
      continue;
    }
    if (c === '"') {
      q = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(f);
      f = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
      i++;
      continue;
    }
    f += c;
    i++;
  }
  if (f.length || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function pad2(n: number | string) {
  const s = String(n);
  return s.length < 2 ? "0" + s : s;
}

/** Turn whatever the bank wrote into YYYY-MM-DD. Returns "" if unparseable. */
export function normDate(s: unknown): string {
  const str = String(s ?? "").trim();
  if (!str) return "";
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
  m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (m) return `20${m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
  const d = new Date(str);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Money out is what we care about. Banks disagree on how to say it:
 *  - one signed Amount column, debits negative   [Chase, most checking]
 *  - one Amount column, charges POSITIVE         [Amex and some card exports]
 *  - separate Debit / Credit columns              [BofA, many credit unions]
 *  `flip` is set per-file by detectSign() below.
 *  Returns a POSITIVE number for money leaving the account, or null to skip. */
export function normAmount(row: string[], map: ColumnMap, flip: boolean): number | null {
  const strip = (v: unknown) => {
    let s = String(v == null ? "" : v).replace(/[$,\s]/g, "").trim();
    const m = s.match(/^\((.*)\)$/);
    if (m) s = "-" + m[1];
    return s;
  };
  if (map.debit != null) {
    const deb = parseFloat(strip(row[map.debit]));
    if (!isNaN(deb) && deb !== 0) return Math.abs(deb);
    return null; // credit / deposit -> not an expense
  }
  const a = parseFloat(strip(map.amount != null ? row[map.amount] : undefined));
  if (isNaN(a) || a === 0) return null;
  if (flip) return a > 0 ? a : null; // card export: positive = charge
  return a < 0 ? Math.abs(a) : null; // bank export: negative = debit
}

/** If a signed-amount file contains no negative values at all, it's a
 *  card-style export where positives are charges. Guessing wrong here would
 *  silently import zero rows, so decide from the data rather than the header. */
export function detectSign(body: string[][], map: ColumnMap): boolean {
  if (map.debit != null || map.amount == null) return false;
  let neg = 0;
  let pos = 0;
  for (const r of body) {
    const v = String(r[map.amount] == null ? "" : r[map.amount]).replace(/[$,\s]/g, "");
    if (/^\(.*\)$/.test(v)) {
      neg++;
      continue;
    }
    const n = parseFloat(v);
    if (isNaN(n) || n === 0) continue;
    if (n < 0) neg++;
    else pos++;
  }
  return neg === 0 && pos > 0; // all positive -> charges are positive
}

/* Aliases are ordered STRONGEST FIRST. detectColumns walks aliases in order
 * and scans every column for each one, so a weak alias never beats a strong
 * one: Chase ships BOTH a "Details" column (holding "DEBIT"/"CREDIT") and a
 * real "Description" column, and we must land on the latter. */
const HDR: Record<keyof ColumnMap, string[]> = {
  date: ["date", "transaction date", "posting date", "post date", "posted date", "trans date", "effective date"],
  desc: ["description", "transaction description", "original description", "payee", "merchant", "name", "memo", "details"],
  amount: ["amount", "transaction amount", "value"],
  debit: ["debit", "withdrawal", "withdrawals", "money out", "payments"],
  credit: ["credit", "deposit", "deposits", "money in"],
};

/** Map header names to column indices.
 *  Exact matches win over substring matches, strong aliases win over weak
 *  ones, and a column is never claimed by two fields. */
export function detectColumns(header: string[]): ColumnMap {
  const norm = header.map((h) => String(h || "").trim().toLowerCase());
  const fields: (keyof ColumnMap)[] = ["date", "desc", "amount", "debit", "credit"];
  const out: ColumnMap = { date: null, desc: null, amount: null, debit: null, credit: null };
  const taken: Record<number, boolean> = {};
  const claim = (f: keyof ColumnMap, i: number) => {
    out[f] = i;
    taken[i] = true;
  };

  // Pass 1: exact header match. Alias order = preference.
  for (const f of fields) {
    const keys = HDR[f];
    let found = false;
    for (const k of keys) {
      for (let i = 0; i < norm.length; i++) {
        if (taken[i]) continue;
        if (norm[i] === k) {
          claim(f, i);
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  // Pass 2: substring match, only for fields still unresolved.
  for (const f of fields) {
    if (out[f] != null) continue;
    const keys = HDR[f];
    let found = false;
    for (const k of keys) {
      for (let i = 0; i < norm.length; i++) {
        if (taken[i] || !norm[i]) continue;
        if (norm[i].indexOf(k) !== -1) {
          claim(f, i);
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  return out;
}

/** Keyword -> subcategory. First hit wins, so order matters: put specific
 * vendors above generic words. Only a suggestion — user confirms on import. */
const GUESS: [RegExp, string][] = [
  [/home ?depot|lowe'?s|menards|ace hardware|hardware/i, "Hardware"],
  [/sherwin|behr|benjamin moore|paint/i, "Interior Paint"],
  [/roof/i, "Roofing"],
  [/electric(al)? (co|llc|inc|supply)|electrician|rewire|panel/i, "Electrical"],
  [/plumb|repipe|pex|rooter/i, "Plumbing"],
  [/hvac|heating|air condition|furnace|a\/c/i, "HVAC"],
  [/drywall|sheetrock/i, "Drywall"],
  [/floor|carpet|hardwood|laminate|vinyl plank/i, "Flooring"],
  [/tile|grout/i, "Tile"],
  [/cabinet/i, "Kitchen Cabinets"],
  [/counter ?top|quartz|granite|slab/i, "Countertops"],
  [/appliance|whirlpool|ge appliance|frigidaire|lg elec/i, "Appliances"],
  [/vanit|toilet|shower|tub|bath/i, "Bathroom Fixtures"],
  [/light|lamp|fixture|chandelier/i, "Lighting"],
  [/landscap|nursery|garden|sod|irrigation|tree/i, "Landscaping"],
  [/fence|fencing/i, "Fencing"],
  [/concrete|driveway|asphalt|paving/i, "Driveway & Concrete"],
  [/dumpster|waste|disposal|junk|haul|debris/i, "Dumpster & Cleanup"],
  [/permit|city of|county of|inspect/i, "Permits & Inspections"],
  [/demo(lition)?/i, "Demolition"],
  [/frami?ng|lumber|truss/i, "Framing"],
  [/window/i, "Windows"],
  [/insulat/i, "Insulation"],
  [/siding/i, "Siding"],
  [/gutter/i, "Gutters"],
  [/title|escrow|first american|fidelity national|chicago title/i, "Title & Escrow"],
  [/apprais/i, "Appraisal"],
  [/pg&e|utility|utilities|water|sewer|electric bill|gas co/i, "Utilities"],
  [/insur/i, "Insurance"],
  [/property tax|tax collector|treasurer/i, "Property Tax"],
  [/hoa|homeowners assoc/i, "HOA Dues"],
  [/interest|loan pmt|mortgage/i, "Loan Interest"],
  [/stag(e|ing)/i, "Staging"],
  [/photo/i, "Photography"],
  [/commission|realtor|brokerage/i, "Listing Commission"],
];
export function guessCategory(desc: string): string | null {
  for (const [re, cat] of GUESS) if (re.test(desc)) return cat;
  return null;
}

/** Same date + same amount + same description = already imported. Matches
 * BankTxn.importHash's unique constraint exactly — same key, same order. */
export function importHash(date: string, amount: number, description: string): string {
  const normalized = description.trim().toLowerCase().replace(/\s+/g, " ");
  return `${date}|${amount.toFixed(2)}|${normalized}`;
}

export interface ImportItem {
  line: number;
  status: "fresh" | "dupe" | "skip";
  date?: string;
  description?: string;
  amount?: number;
  guess?: string | null;
  skipReason?: string;
  raw?: string;
}

export interface ImportResult {
  needsMapping?: boolean;
  header?: string[];
  sampleRows?: string[][];
  map: ColumnMap;
  items: ImportItem[];
  fresh: number;
  dupes: number;
  skips: number;
  error?: string;
}

/** Build the import preview: parsed rows, tagged as new / duplicate / skipped.
 * Does not touch the database — callers decide what to do with `items`. */
export function buildImport(text: string, existingHashes: Set<string>, mapOverride?: ColumnMap): ImportResult {
  const rows = parseCSV(text);
  if (!rows.length) {
    return { map: { date: null, desc: null, amount: null, debit: null, credit: null }, items: [], fresh: 0, dupes: 0, skips: 0, error: "That file is empty." };
  }

  const header = rows[0];
  const map = mapOverride ?? detectColumns(header);
  const hasHeader = map.date != null && map.desc != null;
  const body = hasHeader ? rows.slice(1) : rows;

  if (!hasHeader || (map.amount == null && map.debit == null)) {
    return { needsMapping: true, header, sampleRows: rows.slice(1, 6), map, items: [], fresh: 0, dupes: 0, skips: 0 };
  }

  const flip = detectSign(body, map);
  const seen = new Set<string>();
  const items: ImportItem[] = [];

  body.forEach((r, i) => {
    const line = i + 2;
    const date = normDate(r[map.date!]);
    const description = String(r[map.desc!] == null ? "" : r[map.desc!]).trim();
    const amount = normAmount(r, map, flip);

    if (!date || !description) {
      items.push({ line, status: "skip", skipReason: "Unreadable row", raw: r.join(" ") });
      return;
    }
    if (amount == null) {
      items.push({ line, status: "skip", skipReason: "Deposit or $0 — not an expense", raw: description });
      return;
    }

    const key = importHash(date, amount, description);
    if (existingHashes.has(key) || seen.has(key)) {
      items.push({ line, status: "dupe", date, description, amount });
      return;
    }
    seen.add(key);
    items.push({ line, status: "fresh", date, description, amount, guess: guessCategory(description) });
  });

  return {
    map,
    items,
    fresh: items.filter((x) => x.status === "fresh").length,
    dupes: items.filter((x) => x.status === "dupe").length,
    skips: items.filter((x) => x.status === "skip").length,
  };
}
