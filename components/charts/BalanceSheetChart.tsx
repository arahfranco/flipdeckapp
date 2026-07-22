import { Prisma } from "@prisma/client";
import { barPath, moneyCompact, num } from "@/lib/chart";
import { money } from "@/lib/format";

interface Props {
  assets: Prisma.Decimal;
  liabilities: Prisma.Decimal;
  equity: Prisma.Decimal;
}

const W = 660;
const ROW_H = 44;
const BAR_H = 22; // at the 24px cap — only three bars, so they carry the view
const LABEL_W = 128;
const RIGHT_PAD = 74;
const VAL_PAD = 62; // room for an end-label on a negative bar
const TOP = 6;

/**
 * Assets, liabilities and equity at the same scale, so the proportion between
 * them is readable at a glance — which the three stat tiles above cannot show.
 * Each bar is named on the axis, so identity never rests on colour and no
 * legend is needed.
 */
export function BalanceSheetChart({ assets, liabilities, equity }: Props) {
  const rows = [
    { key: "Total Assets", value: num(assets), fill: "var(--viz-1)" },
    { key: "Liabilities", value: num(liabilities), fill: "var(--viz-2)" },
    { key: "Company Equity", value: num(equity), fill: "var(--viz-3)" },
  ];

  // ONE linear scale across the whole axis, so negative equity draws to the
  // same scale as the assets it is measured against. Giving each side its own
  // sub-width would make the bars incomparable.
  const maxPos = Math.max(0, ...rows.map((r) => r.value));
  const maxNeg = Math.min(0, ...rows.map((r) => r.value));
  // Negative equity needs end-label room on the left, or the label collides
  // with the row name.
  const negPad = maxNeg < 0 ? VAL_PAD : 0;
  const plotW = W - LABEL_W - RIGHT_PAD - negPad;
  const totalSpan = maxPos + Math.abs(maxNeg) || 1;
  const pxPerUnit = plotW / totalSpan;
  const zeroX = LABEL_W + negPad + Math.abs(maxNeg) * pxPerUnit;
  const scale = (v: number) => v * pxPerUnit;
  const H = TOP + rows.length * ROW_H;

  if (rows.every((r) => r.value === 0)) {
    return (
      <p className="empty" style={{ padding: "26px 0" }}>
        Nothing to chart yet — add a property value or a bank account.
      </p>
    );
  }

  return (
    <figure className="viz">
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img"
           aria-label="Total assets, total liabilities and company equity compared at the same scale">
        <line x1={zeroX} x2={zeroX} y1={TOP} y2={TOP + rows.length * ROW_H - 10} className="viz-axis" />

        {rows.map((r, i) => {
          const y = TOP + i * ROW_H + (ROW_H - BAR_H) / 2;
          const end = zeroX + scale(r.value);
          const neg = r.value < 0;
          return (
            <g key={r.key}>
              <text x={LABEL_W - 12} y={y + BAR_H / 2} className="viz-cat" textAnchor="end" dominantBaseline="middle">
                {r.key}
              </text>
              <path d={barPath(zeroX, end, y, BAR_H)} fill={neg ? "var(--viz-neg)" : r.fill}>
                <title>{`${r.key} — ${money(r.value)}`}</title>
              </path>
              <text x={neg ? end - 8 : end + 8} y={y + BAR_H / 2} className="viz-val"
                    textAnchor={neg ? "end" : "start"} dominantBaseline="middle">
                {moneyCompact(r.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="viz-cap">
        Equity is assets minus liabilities. Sold properties are excluded from assets — their proceeds are counted
        as cash instead.
      </figcaption>
    </figure>
  );
}
