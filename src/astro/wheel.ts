/**
 * Geometry for the chart wheel — the pure part, kept out of the SVG so it can
 * be tested without a DOM.
 *
 * Convention: the Ascendant's sign starts at 9 o'clock and the zodiac runs
 * counter-clockwise, so the first house sits below the horizon on the left,
 * as every printed chart has it. Without a birth time the wheel is unrotated
 * (0° Aries on the left) and has no houses.
 */

/** Screen angle in degrees (0 = 3 o'clock, counter-clockwise positive) for an ecliptic longitude. */
export const screenAngle = (lon: number, base: number): number =>
  (((180 + lon - base) % 360) + 360) % 360;

export const point = (cx: number, cy: number, r: number, angleDeg: number): [number, number] => {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
};

/**
 * Nudge glyph angles apart so none sit closer than `minSep` degrees, while
 * keeping their circular order. The tick at the true longitude stays put;
 * only the glyph moves. Neighbours are pushed apart by half the shortfall
 * until a pass changes nothing; each pass halves the remaining error, so a
 * cluster settles in a few dozen iterations.
 * ponytail: iterative push, capped at 200 passes; fine for ten bodies.
 */
export function spreadAngles(angles: readonly number[], minSep: number): number[] {
  const n = angles.length;
  if (n < 2) return [...angles];
  const order = angles.map((_, i) => i).sort((a, b) => angles[a]! - angles[b]!);
  const out = [...angles];
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let k = 0; k < n; k++) {
      const i = order[k]!;
      const j = order[(k + 1) % n]!;
      let gap = out[j]! - out[i]!;
      if (k === n - 1) gap += 360;
      if (gap < minSep) {
        const push = (minSep - gap) / 2;
        out[i] = out[i]! - push;
        out[j] = out[j]! + push;
        moved = push > 1e-6;
      }
    }
    if (!moved) break;
  }
  return out.map((a) => ((a % 360) + 360) % 360);
}
