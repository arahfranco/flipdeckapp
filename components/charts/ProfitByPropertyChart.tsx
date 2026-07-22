import { Prisma, Status } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/constants";
import { barPath, moneyCompact, num } from "@/lib/chart";
import { money } from "@/lib/format";

interface Row {
  id: string;
  address: string;
  status: Status;
  profit: Prisma.Decimal;
}

const W = 660;
const ROW_H = 30;
const BAR_H = 16;
const LABEL_W = 168;
const RIGHT_PAD = 62;
const VAL_PAD = 56; // room for an end-label on the longest loss
const TOP = 6;

/**
 * Profit per property. A single series, so no legend — but profit has a sign,
 * so the bar's side of the zero line carries polarity and colour only
 * reinforces it. Sign is never colour-alone: every bar is value-labelled.
 */
export function ProfitByPropertyChart({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <p className="empty" style={{ padding: "26px 0" }}>No properties yet.</p>;
  }

  const values = rows.map((r) => num(r.profit));
  const maxPos = Math.max(0, ...values);
  const maxNeg = Math.min(0, ...values);

  // ONE linear scale across the whole axis. Scaling each side to its own
  // sub-width would make a loss and a gain of equal size draw different
  // lengths — the chart would misstate the data rather than merely look odd.
  //
  // Losses also need their own end-label room: the longest loss reaches the
  // left edge of the plot, and without this its label would land on top of the
  // property name.
  const negPad = maxNeg < 0 ? VAL_PAD : 0;
  const plotW = W - LABEL_W - RIGHT_PAD - negPad;
  const totalSpan = maxPos + Math.abs(maxNeg) || 1;
  const pxPerUnit = plotW / totalSpan;
  const zeroX = LABEL_W + negPad + Math.abs(maxNeg) * pxPerUnit;
  const scale = (v: number) => v * pxPerUnit;
  const H = TOP + rows.length * ROW_H + 6;

  return (
    <figure className="viz">
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img"
           aria-label="Profit for each property, positive to the right of zero and losses to the left">
        <line x1={zeroX} x2={zeroX} y1={TOP} y2={TOP + rows.length * ROW_H} className="viz-axis" />

        {rows.map((r, i) => {
          const v = num(r.profit);
          const y = TOP + i * ROW_H + (ROW_H - BAR_H) / 2;
          const end = zeroX + scale(v);
          const neg = v < 0;
          return (
            <g key={r.id}>
              <text x={LABEL_W - 12} y={y + BAR_H / 2} className="viz-cat" textAnchor="end" dominantBaseline="middle">
                {r.address.length > 26 ? r.address.slice(0, 25) + "…" : r.address}
              </text>
              <path d={barPath(zeroX, end, y, BAR_H)} fill={neg ? "var(--viz-neg)" : "var(--viz-1)"}>
                <title>{`${r.address} (${STATUS_LABELS[r.status]}) — ${money(v)}`}</title>
              </path>
              <text x={neg ? end - 7 : end + 7} y={y + BAR_H / 2} className="viz-val"
                    textAnchor={neg ? "end" : "start"} dominantBaseline="middle">
                {moneyCompact(v)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="viz-cap">
        Measured against the actual sale price once sold, and against the estimated sale price until then.
      </figcaption>
    </figure>
  );
}
