/**
 * 人元司令 — which hidden stem of the month branch is actually in charge.
 *
 * The month branch carries the most weight in judging 旺衰, and which of its
 * 藏干 rules is not fixed: it depends on how many days after the opening 节 the
 * birth falls. Someone born on the second day of 午月 is under a different
 * ruler than someone born on the twenty-fifth, and a scorer that weights the
 * hidden stems by role alone treats them identically.
 *
 * The tables below are the classical 分野. Two notes on how they are applied:
 *
 *  1. A sequence sometimes names a stem the branch does not contain — 子 opens
 *     with 壬, 午 with 丙, 亥 with 戊 — because those are the 余气 carried over
 *     from the previous branch. Our 藏干 table (and tyme4ts's) does not hold
 *     them. When the classical ruler is absent, the 本气 rules instead. That
 *     keeps the classical timing while staying inside the stems the chart
 *     actually has.
 *  2. A solar month runs about 30.44 days and the tables sum to 30, so a birth
 *     past the end stays with the final entry rather than falling off it.
 */

import type { HiddenStem } from '../engine/types';

interface Span {
  readonly stem: string;
  readonly days: number;
}

/** 人元司令分野, in order from the opening 节. */
const SILING: Record<string, readonly Span[]> = {
  寅: [{ stem: '戊', days: 7 }, { stem: '丙', days: 7 }, { stem: '甲', days: 16 }],
  卯: [{ stem: '甲', days: 10 }, { stem: '乙', days: 20 }],
  辰: [{ stem: '乙', days: 9 }, { stem: '癸', days: 3 }, { stem: '戊', days: 18 }],
  巳: [{ stem: '戊', days: 5 }, { stem: '庚', days: 9 }, { stem: '丙', days: 16 }],
  午: [{ stem: '丙', days: 10 }, { stem: '己', days: 9 }, { stem: '丁', days: 11 }],
  未: [{ stem: '丁', days: 9 }, { stem: '乙', days: 3 }, { stem: '己', days: 18 }],
  申: [{ stem: '戊', days: 7 }, { stem: '壬', days: 7 }, { stem: '庚', days: 16 }],
  酉: [{ stem: '庚', days: 10 }, { stem: '辛', days: 20 }],
  戌: [{ stem: '辛', days: 9 }, { stem: '丁', days: 3 }, { stem: '戊', days: 18 }],
  亥: [{ stem: '戊', days: 7 }, { stem: '甲', days: 7 }, { stem: '壬', days: 16 }],
  子: [{ stem: '壬', days: 10 }, { stem: '癸', days: 20 }],
  丑: [{ stem: '癸', days: 9 }, { stem: '辛', days: 3 }, { stem: '己', days: 18 }],
};

export interface SiLing {
  /** The stem in charge, always one the branch actually contains. */
  readonly stem: string;
  /** The classical ruler, which may be a carried-over 余气 not in the branch. */
  readonly classicalStem: string;
  /** True when the classical ruler is absent and the 本气 stood in for it. */
  readonly substituted: boolean;
  readonly daysIntoTerm: number;
}

/**
 * Who rules the month branch on this day.
 *
 * `hiddenStems` comes from the chart, so the answer is always a stem the
 * scorer can actually weight.
 */
export function rulingStem(
  branch: string,
  daysIntoTerm: number,
  hiddenStems: readonly HiddenStem[],
): SiLing {
  const spans = SILING[branch];
  const main = hiddenStems.find((h) => h.role === 'main') ?? hiddenStems[0];

  if (!spans || !main) {
    return {
      stem: main?.stem ?? '',
      classicalStem: main?.stem ?? '',
      substituted: false,
      daysIntoTerm,
    };
  }

  const elapsed = Math.max(0, daysIntoTerm);
  let cursor = 0;
  let classical = spans[spans.length - 1]!.stem;

  for (const span of spans) {
    cursor += span.days;
    if (elapsed < cursor) { classical = span.stem; break; }
  }

  const present = hiddenStems.some((h) => h.stem === classical);
  return {
    stem: present ? classical : main.stem,
    classicalStem: classical,
    substituted: !present,
    daysIntoTerm: elapsed,
  };
}

/**
 * Share of the month branch's weight each hidden stem takes.
 *
 * The ruler takes a little over half; the rest splits by role. When the 本气
 * happens to be ruling, this lands close to the old fixed 0.6/0.3/0.1 split,
 * which is the sanity check that the change only moves what it should.
 */
export const RULER_SHARE = 0.55;

const ROLE_WEIGHT = { main: 6, middle: 3, residual: 1 } as const;

export function silingShares(
  hiddenStems: readonly HiddenStem[],
  ruler: string,
): Map<string, number> {
  const shares = new Map<string, number>();
  if (hiddenStems.length === 0) return shares;
  if (hiddenStems.length === 1) {
    shares.set(hiddenStems[0]!.stem, 1);
    return shares;
  }

  const others = hiddenStems.filter((h) => h.stem !== ruler);
  const otherTotal = others.reduce((sum, h) => sum + ROLE_WEIGHT[h.role], 0);

  shares.set(ruler, RULER_SHARE);
  for (const h of others) {
    shares.set(h.stem, otherTotal === 0 ? 0 : (1 - RULER_SHARE) * (ROLE_WEIGHT[h.role] / otherTotal));
  }
  return shares;
}
