import { describe, it, expect } from "vitest";
import { niceTicks, barPath, moneyCompact } from "../chart";

describe("niceTicks", () => {
  it("always reaches at or above the maximum value", () => {
    // The bug this guards: ticks stopping below max scales the largest bar past
    // the plot area, drawing it and its label outside the chart.
    for (const max of [163400, 1, 999, 1000, 12345, 7, 250000, 1_284_000]) {
      const ticks = niceTicks(max);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it("starts at zero and steps evenly", () => {
    const ticks = niceTicks(163400);
    expect(ticks[0]).toBe(0);
    const steps = ticks.slice(1).map((t, i) => t - ticks[i]);
    for (const s of steps) expect(s).toBeCloseTo(steps[0], 6);
  });

  it("uses round numbers", () => {
    expect(niceTicks(163400)).toEqual([0, 50000, 100000, 150000, 200000]);
  });

  it("handles a zero or negative maximum without looping forever", () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(-5)).toEqual([0]);
  });
});

describe("barPath", () => {
  /** Horizontal extent of the path — only the x operands, not y or radii. */
  const width = (d: string) => {
    const t = d.trim().split(/\s+/);
    const xs: number[] = [];
    for (let i = 0; i < t.length; i++) {
      if (t[i] === "M" || t[i] === "H") xs.push(Number(t[i + 1]));
      else if (t[i] === "A") xs.push(Number(t[i + 6])); // A rx ry rot laf sweep x y
    }
    return Math.max(...xs) - Math.min(...xs);
  };

  // A gain and a loss of equal size must draw equal length, or the chart
  // misstates the data.
  it("draws mirrored bars of equal length", () => {
    const right = barPath(100, 180, 0, 16);
    const left = barPath(100, 20, 0, 16);
    expect(width(right)).toBeCloseTo(width(left), 6);
  });

  it("returns nothing for a zero-length bar", () => {
    expect(barPath(100, 100, 0, 16)).toBe("");
  });

  it("never rounds more than the bar is wide", () => {
    // A 2px bar with a 4px radius would otherwise produce an inverted arc.
    expect(barPath(0, 2, 0, 16)).toContain("A 2 2");
  });
});

describe("moneyCompact", () => {
  it("compacts by magnitude", () => {
    expect(moneyCompact(0)).toBe("$0");
    expect(moneyCompact(940)).toBe("$940");
    expect(moneyCompact(1500)).toBe("$1.5K");
    expect(moneyCompact(163400)).toBe("$163K");
    expect(moneyCompact(1_284_000)).toBe("$1.3M");
    expect(moneyCompact(12_000_000)).toBe("$12M");
  });

  it("keeps the sign on losses", () => {
    expect(moneyCompact(-23400)).toBe("-$23K");
  });
});
