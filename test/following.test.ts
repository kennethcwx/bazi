/**
 * 从格 — determined, not flagged.
 *
 * Two things have to hold at once here and they pull against each other: the
 * verdict must be REACHABLE (all four 格 and both 真/假, or the conditions are
 * decoration), and it must stay RARE. 从格 is uncommon in practice, so a model
 * that finds it often is miscalibrated rather than perceptive — an upper bound
 * is as much a correctness test as a lower one, and neither alone would catch a
 * threshold set wrong.
 *
 * The condition tests are negative controls in the strict sense: each asserts
 * that charts failing one requirement are NOT read as 从, which is the only way
 * to tell a working gate from a rubber stamp.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { analyzeStrength } from '../src/analyzer/strength';
import { analyzeYongShen } from '../src/analyzer/yongshen';
import { tenGodFamily, isSupporting, familyElement } from '../src/analyzer/elements';
import type { BirthInput } from '../src/engine/types';

const at = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 0,
  timeZone: 'Asia/Shanghai', longitude: 116.4, gender: 'male',
  useTrueSolarTime: false, ...o,
});

/**
 * Charts that DO follow, one per 格, found by sweeping 1930-2020 and pinned
 * here by date. Reachability is proven by these rather than by hoping a sweep
 * happens to contain each case — 从财格 lands on roughly a third of a percent
 * of charts, so a thin sweep misses it and the test then fails for a reason
 * that has nothing to do with the code.
 */
const PINNED: ReadonlyArray<readonly [string, Partial<BirthInput>]> = [
  ['从财格', { year: 1933, month: 9, day: 27, hour: 1 }],   // 真从, 阳干
  ['从杀格', { year: 1933, month: 4, day: 3, hour: 17 }],   // 真从
  ['从官格', { year: 1951, month: 10, day: 12, hour: 9 }],  // 假从
  ['从儿格', { year: 1957, month: 7, day: 12, hour: 9 }],   // 真从
];

const SWEEP = (() => {
  const out = [];
  for (let year = 1930; year <= 2020; year += 10) {
    for (let month = 1; month <= 12; month++) {
      for (const day of [6, 18, 27]) {
        for (const hour of [3, 15]) {
          out.push(buildChart(at({ year, month, day, hour })));
        }
      }
    }
  }
  return out;
})();

const ANALYSES = SWEEP.map((c) => analyzeChart(c));
const FOLLOWING = ANALYSES.filter((a) => a.strength.following !== null);

describe('从格 fires, and fires rarely', () => {
  it('reaches all four 格', () => {
    for (const [kind, birth] of PINNED) {
      const a = analyzeChart(buildChart(at(birth)));
      expect(a.strength.following, `${kind}: chart no longer follows`).not.toBeNull();
      expect(a.strength.following!.kind).toBe(kind);
    }
  });

  it('reaches both 真从 and 假从', () => {
    const all = [...FOLLOWING, ...PINNED.map(([, b]) => analyzeChart(buildChart(at(b))))];
    expect(all.some((a) => a.strength.following!.genuine)).toBe(true);
    expect(all.some((a) => !a.strength.following!.genuine)).toBe(true);
  });

  it('stays rare — under 5% of charts', () => {
    const rate = FOLLOWING.length / ANALYSES.length;
    expect(rate).toBeGreaterThan(0.002);
    expect(rate, `从格 fired on ${(rate * 100).toFixed(2)}% of charts`).toBeLessThan(0.05);
  });
});

describe('every condition actually gates', () => {
  it('never follows a chart the month feeds (得令)', () => {
    for (const a of FOLLOWING) expect(a.strength.hasMonthCommand).toBe(false);
  });

  it('only follows the family that commands the month', () => {
    for (const a of FOLLOWING) {
      const dm = a.chart.dayMasterElement;
      const ruler = a.chart.pillars.month.hiddenStems
        .find((h) => h.stem === a.strength.siLing.stem);
      expect(ruler).toBeDefined();
      expect(tenGodFamily(dm, ruler!.element)).toBe(a.strength.following!.family);
    }
  });

  it('only follows a force exposed in a visible stem', () => {
    for (const a of FOLLOWING) {
      const dm = a.chart.dayMasterElement;
      const stems = [a.chart.pillars.year, a.chart.pillars.month, a.chart.pillars.hour]
        .filter((p) => p !== null)
        .map((p) => tenGodFamily(dm, p!.stemElement));
      expect(stems).toContain(a.strength.following!.family);
    }
  });

  it('never follows a force that a visible stem attacks (破格)', () => {
    const BREAKER = { 财: '比劫', 官杀: '食伤', 食伤: '印' } as const;
    for (const a of FOLLOWING) {
      const f = a.strength.following!.family as keyof typeof BREAKER;
      const dm = a.chart.dayMasterElement;
      const stems = [a.chart.pillars.year, a.chart.pillars.month, a.chart.pillars.hour]
        .filter((p) => p !== null)
        .map((p) => tenGodFamily(dm, p!.stemElement));
      expect(stems).not.toContain(BREAKER[f]);
    }
  });

  it('holds 阳干 to a stricter root than 阴干, outside 从儿', () => {
    for (const a of FOLLOWING) {
      if (a.strength.following!.family === '食伤') continue;
      const ceiling = a.chart.dayMasterYinYang === '阳' ? 3 : 10;
      expect(a.strength.supportPercent).toBeLessThanOrEqual(ceiling);
    }
    // Both polarities must actually occur, or the ceiling above proved nothing.
    // 1933-09-27 is the pinned 阳干 case; 阴干 ones are common in the sweep.
    const pol = new Set([
      ...FOLLOWING.map((a) => a.chart.dayMasterYinYang),
      analyzeChart(buildChart(at(PINNED[0]![1]))).chart.dayMasterYinYang,
    ]);
    expect(pol.size).toBe(2);
  });

  it('calls it 真从 only when nothing at all supports the day master', () => {
    for (const a of FOLLOWING) {
      if (a.strength.following!.genuine) {
        expect(a.strength.supportPercent).toBeLessThanOrEqual(3);
      } else {
        expect(a.strength.supportPercent).toBeGreaterThan(3);
      }
    }
  });

  it('never tells a 阳干 chart that a yin day master yields', () => {
    // The 假从 wording differs by case, and getting it backwards would have the
    // reasoning assert something the chart contradicts.
    for (const a of FOLLOWING) {
      if (a.chart.dayMasterYinYang !== '阳') continue;
      const zh = a.strength.reasoning.map((r) => r.zh).join('\n');
      expect(zh).not.toContain('阴干可舍命相从');
    }
  });
});

describe('用神 inverts under 从格', () => {
  it('feeds the dominant force and rejects 比劫 and 印', () => {
    for (const a of FOLLOWING) {
      const f = a.strength.following!;
      const dm = a.chart.dayMasterElement;
      // What the chart wants is the followed force itself.
      expect(a.yongShen.primary).toBe(familyElement(dm, f.family));
      // And its own side is never favourable — that is the whole inversion.
      for (const e of a.yongShen.favourable) {
        expect(isSupporting(tenGodFamily(dm, e))).toBe(false);
      }
    }
  });

  it('names the 格 as the method, rather than claiming 扶抑', () => {
    for (const a of FOLLOWING) {
      expect(a.yongShen.school.zh).toContain(a.strength.following!.kind);
      expect(a.yongShen.school.zh).not.toContain('扶抑为主');
    }
  });

  it('drops the climate modifier, which does not apply to a 从格', () => {
    for (const a of FOLLOWING) {
      expect(a.yongShen.climateNeed).toBeNull();
      expect(a.yongShen.climateConflict).toBe(false);
    }
  });

  // NEGATIVE CONTROL: ordinary charts must be untouched by any of this.
  it('leaves every ordinary chart on 扶抑', () => {
    // 化气 and 专旺 also replace 扶抑, so "not 从格" is no longer the same thing
    // as "ordinary" — see test/special.test.ts.
    const ordinary = ANALYSES.filter(
      (a) => a.strength.following === null && a.strength.special === null,
    );
    expect(ordinary.length).toBeGreaterThan(FOLLOWING.length * 10);
    for (const a of ordinary) {
      expect(a.yongShen.school.zh).toContain('扶抑');
    }
  });

  it('is deterministic', () => {
    const c = SWEEP.find((x) => analyzeStrength(x).following !== null)!;
    const a = analyzeYongShen(c, analyzeStrength(c));
    const b = analyzeYongShen(c, analyzeStrength(c));
    expect(b.primary).toBe(a.primary);
    expect(b.favourable).toEqual(a.favourable);
  });
});
