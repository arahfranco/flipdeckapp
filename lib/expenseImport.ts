import { parseCSV, normDate } from "./csvImport";

// Bulk expense import. The mapping is deliberately trivial: a fixed-header
// template and a single chosen property mean there is nothing for the user to
// map — the columns are known and every row belongs to that property. The only
// lookup is the subcategory, which is validated against the known list with a
// close-match suggestion when it's off.

export const EXPENSE_TEMPLATE_HEADERS = ["Date", "Subcategory", "Amount", "Description", "Status"] as const;

export type ImportStatus = "PENDING" | "PAID" | "REIMBURSED";

export interface ExpenseImportRow {
  line: number;
  ok: boolean;
  /** Otherwise-valid row whose only problem is a missing date — offered for
   *  inline date entry in the preview rather than reported as an error. */
  needsDate?: boolean;
  error?: string;
  date?: string;
  subcategory?: string;
  amount?: number;
  description?: string;
  status?: ImportStatus;
}

export interface ExpenseImportResult {
  headerError?: string;
  rows: ExpenseImportRow[];
  okCount: number;
  needsDateCount: number;
  errorCount: number;
}

export interface ExpenseImportOptions {
  /** When true, rows missing a required value (amount or subcategory) are
   *  skipped silently instead of listed as problems. Default true. */
  ignoreBlanks?: boolean;
}

const STATUS_ALIASES: Record<string, ImportStatus> = {
  pending: "PENDING",
  paid: "PAID",
  reimbursed: "REIMBURSED",
  reimburse: "REIMBURSED",
};

/** Case/space-insensitive exact match, else a best-effort suggestion. */
function matchSubcategory(input: string, valid: string[]): { match: string | null; suggestion: string | null } {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const target = norm(input);
  if (!target) return { match: null, suggestion: null };

  const exact = valid.find((v) => norm(v) === target);
  if (exact) return { match: exact, suggestion: null };

  // One contains the other — catches "kitchen" -> "Kitchen Remodel", "labor " etc.
  const near = valid.find((v) => {
    const n = norm(v);
    return n.includes(target) || target.includes(n);
  });
  return { match: null, suggestion: near ?? null };
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[$,\s]/g, ""));
}

/**
 * Parses the template CSV and validates every row against the property's valid
 * subcategories. Never throws — bad rows come back flagged with a reason so the
 * whole import isn't lost to one typo.
 */
export function buildExpenseImport(
  text: string,
  validSubcategories: string[],
  options: ExpenseImportOptions = {},
): ExpenseImportResult {
  const ignoreBlanks = options.ignoreBlanks ?? true;
  const grid = parseCSV(text);
  if (grid.length === 0) {
    return { headerError: "The file is empty.", rows: [], okCount: 0, needsDateCount: 0, errorCount: 0 };
  }

  const header = grid[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const iDate = col("date");
  const iSub = col("subcategory");
  const iAmt = col("amount");
  const iDesc = col("description");
  const iStatus = col("status");

  if (iDate < 0 || iSub < 0 || iAmt < 0) {
    return {
      headerError: 'Missing required columns. The first row must include "Date", "Subcategory", and "Amount".',
      rows: [],
      okCount: 0,
      needsDateCount: 0,
      errorCount: 0,
    };
  }

  const rows: ExpenseImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    // Skip a fully blank line (trailing newline, spacer rows) silently.
    if (cells.every((c) => c.trim() === "")) continue;

    const line = r + 1; // 1-based, counting the header
    const rawDate = cells[iDate] ?? "";
    const rawSub = cells[iSub] ?? "";
    const rawAmt = cells[iAmt] ?? "";
    const description = (iDesc >= 0 ? cells[iDesc] : "")?.trim() ?? "";

    // Amount and subcategory can't be fixed inside the preview. If either is
    // blank, honour the "ignore blanks" choice: skip quietly, or flag it.
    const amtBlank = rawAmt.trim() === "";
    const subBlank = rawSub.trim() === "";
    if (amtBlank || subBlank) {
      if (ignoreBlanks) continue;
      const missing = [amtBlank && "amount", subBlank && "subcategory"].filter(Boolean).join(" and ");
      rows.push({ line, ok: false, error: `Missing ${missing}.` });
      continue;
    }

    const amount = parseAmount(rawAmt);
    if (isNaN(amount) || amount <= 0) {
      rows.push({ line, ok: false, error: `Amount "${rawAmt.trim()}" isn't a positive number.` });
      continue;
    }

    const { match, suggestion } = matchSubcategory(rawSub, validSubcategories);
    if (!match) {
      rows.push({
        line,
        ok: false,
        error: `Unknown subcategory "${rawSub.trim()}"${suggestion ? ` — did you mean "${suggestion}"?` : ""}`,
      });
      continue;
    }

    // Status is lenient: blank defaults to Pending; an unknown value is flagged.
    const rawStatus = (iStatus >= 0 ? cells[iStatus] : "")?.trim() ?? "";
    let status: ImportStatus = "PENDING";
    if (rawStatus) {
      const mapped = STATUS_ALIASES[rawStatus.toLowerCase()];
      if (!mapped) {
        rows.push({ line, ok: false, error: `Unknown status "${rawStatus}". Use Pending, Paid, or Reimbursed.` });
        continue;
      }
      status = mapped;
    }

    // Date is the one field that can be supplied from the preview. A blank date
    // becomes a "needs a date" row (offered a picker) rather than an error; a
    // present-but-unreadable date is still a genuine error.
    if (rawDate.trim() === "") {
      rows.push({ line, ok: false, needsDate: true, subcategory: match, amount, description, status });
      continue;
    }
    const date = normDate(rawDate);
    if (!date) {
      rows.push({ line, ok: false, error: `Couldn't read the date "${rawDate.trim()}". Use YYYY-MM-DD.` });
      continue;
    }

    rows.push({ line, ok: true, date, subcategory: match, amount, description, status });
  }

  const okCount = rows.filter((r) => r.ok).length;
  const needsDateCount = rows.filter((r) => r.needsDate).length;
  return { rows, okCount, needsDateCount, errorCount: rows.length - okCount - needsDateCount };
}

/** The downloadable starter file: header plus two example rows using real subcategories. */
export function expenseTemplateCsv(sampleSubcategories: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const a = sampleSubcategories[0] ?? "Building Materials";
  const b = sampleSubcategories[1] ?? "Labor";
  return [
    EXPENSE_TEMPLATE_HEADERS.join(","),
    `${today},${a},1250.00,Example — delete this row,Paid`,
    `${today},${b},800,Another example,Pending`,
  ].join("\r\n");
}
