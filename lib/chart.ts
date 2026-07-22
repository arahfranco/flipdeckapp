import { Prisma } from "@prisma/client";

type Numberish = number | Prisma.Decimal;

export const num = (n: Numberish): number => (typeof n === "number" ? n : n.toNumber());

/**
 * Compact money for axis ticks and tight labels: $1.2M, $940K, $0.
 * Full precision stays in the tables beside every chart.
 */
export function moneyCompact(v: Numberish): string {
  const n = num(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/**
 * Horizontal bar as a path: rounded at the data end, square at the baseline,
 * per the mark spec. A rect with rx would round the baseline corners too,
 * detaching the bar from the axis it grows from.
 *
 * `x0` is the baseline, `x1` the data end. Handles x1 < x0 (bar to the left of
 * zero) by mirroring the rounded end.
 */
export function barPath(x0: number, x1: number, y: number, h: number, radius = 4): string {
  const w = Math.abs(x1 - x0);
  const r = Math.max(0, Math.min(radius, w, h / 2));
  const dir = x1 >= x0 ? 1 : -1;
  const end = x0 + dir * w;
  const preEnd = x0 + dir * (w - r);
  const sweep = dir === 1 ? 1 : 0;

  if (w === 0) return "";
  return [
    `M ${x0} ${y}`,
    `H ${preEnd}`,
    `A ${r} ${r} 0 0 ${sweep} ${end} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 ${sweep} ${preEnd} ${y + h}`,
    `H ${x0}`,
    "Z",
  ].join(" ");
}

/** Axis ticks on clean round numbers, always including 0. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;

  // Round the top UP to a whole step so the axis always contains the data.
  // Stopping at the last tick below max leaves the largest bar scaled past the
  // plot area, drawing itself and its label outside the chart.
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top + step * 1e-6; t += step) ticks.push(t);
  return ticks;
}
