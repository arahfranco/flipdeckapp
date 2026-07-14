import { Prisma } from "@prisma/client";

type Numberish = number | Prisma.Decimal;

function toNum(n: Numberish): number {
  return typeof n === "number" ? n : n.toNumber();
}

export const money = (n: Numberish) =>
  toNum(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const money2 = (n: Numberish) =>
  toNum(n).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export const pct = (n: number) => `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(1)}%`;
