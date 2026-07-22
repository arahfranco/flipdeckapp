import { Prisma } from "@prisma/client";
import { COST_CATEGORIES, type Category } from "@/lib/constants";
import { barPath, moneyCompact, niceTicks, num } from "@/lib/chart";
import { money } from "@/lib/format";

interface Props {
  byCat: Record<Category, { estimated: Prisma.Decimal; actual: Prisma.Decimal }>;
}

const W = 660;
const ROW_H = 46;
const BAR_H = 14; // <= 24px cap; two bars + a 2px gap inside each row
const GAP = 2; // the surface gap between the paired bars
const LABEL_W = 108;
const RIGHT_PAD = 58; // room for the value label at the bar tip
const TOP = 8;
const AXIS_H = 22;

/**
 * Estimated against actual for the four cost categories. Revenue (Selling
 * Price) is excluded — mixing it in would make the cost bars unreadable and
 * imply it belongs to the same total.
 */
export function BudgetVsActualChart({ byCat }: Props) {
  const rows = COST_CATEGORIES.map((c) => ({
    category: c,
    estimated: num(byCat[c].estimated),
    actual: num(byCat[c].actual),
  }));

  const max = Math.max(...rows.flatMap((r) => [r.estimated, r.actual]), 0);
  const ticks = niceTicks(max);
  const scaleMax = ticks[ticks.length - 1] || 1;
  const plotW = W - LABEL_W - RIGHT_PAD;
  const x = (v: number) => LABEL_W + (v / scaleMax) * plotW;
  const H = TOP + rows.length * ROW_H + AXIS_H;

  if (max === 0) {
    return (
      <p className="empty" style={{ padding: "26px 0" }}>
        Nothing budgeted or spent yet — set estimates on the Budget tab.
      </p>
    );
  }

  return (
    <figure className="viz">
      <div className="viz-legend">
        <span>
          <i style={{ background: "var(--viz-1)" }} /> Estimated
        </span>
        <span>
          <i style={{ background: "var(--viz-2)" }} /> Actual
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img"
           aria-label="Estimated versus actual cost for each budget category">
        {/* gridlines behind the marks, hairline and solid */}
        {ticks.map((t) => (
          <line key={t} x1={x(t)} x2={x(t)} y1={TOP} y2={TOP + rows.length * ROW_H}
                className={t === 0 ? "viz-axis" : "viz-grid"} />
        ))}

        {rows.map((r, i) => {
          const yTop = TOP + i * ROW_H + (ROW_H - (BAR_H * 2 + GAP)) / 2;
          const yBottom = yTop + BAR_H + GAP;
          const over = r.actual > r.estimated && r.estimated > 0;
          return (
            <g key={r.category}>
              <text x={LABEL_W - 10} y={TOP + i * ROW_H + ROW_H / 2} className="viz-cat" textAnchor="end"
                    dominantBaseline="middle">
                {r.category.replace(" Costs", "")}
              </text>

              <path d={barPath(x(0), x(r.estimated), yTop, BAR_H)} fill="var(--viz-1)">
                <title>{`${r.category} — estimated ${money(r.estimated)}`}</title>
              </path>
              <path d={barPath(x(0), x(r.actual), yBottom, BAR_H)} fill="var(--viz-2)">
                <title>{`${r.category} — actual ${money(r.actual)}`}</title>
              </path>

              {/* Only the actual is labelled: it is what the reader is checking,
                  and a number on all eight bars would stop being read. */}
              <text x={x(r.actual) + 7} y={yBottom + BAR_H / 2} className="viz-val" dominantBaseline="middle">
                {moneyCompact(r.actual)}
                {over ? " !" : ""}
              </text>
            </g>
          );
        })}

        {ticks.map((t) => (
          <text key={t} x={x(t)} y={TOP + rows.length * ROW_H + 15} className="viz-tick" textAnchor="middle">
            {moneyCompact(t)}
          </text>
        ))}
      </svg>
      <figcaption className="viz-cap">
        Actual is derived from the expense log. An exclamation mark flags a category running over its estimate.
      </figcaption>
    </figure>
  );
}
