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
  errorCount: number;
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
export function buildExpenseImport(text: string, validSubcategories: string[]): ExpenseImportResult {
  const grid = parseCSV(text);
  if (grid.length === 0) {
    return { headerError: "The file is empty.", rows: [], okCount: 0, errorCount: 0 };
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

    const date = normDate(rawDate);
    if (!date) {
      rows.push({ line, ok: false, error: `Couldn't read the date "${rawDate.trim()}". Use YYYY-MM-DD.` });
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

    rows.push({ line, ok: true, date, subcategory: match, amount, description, status });
  }

  const okCount = rows.filter((r) => r.ok).length;
  return { rows, okCount, errorCount: rows.length - okCount };
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
