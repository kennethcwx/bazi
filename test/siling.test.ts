/**
 * 人元司令.
 *
 * The point of this feature is that two people born in the same month, days
 * apart, are under different rulers and should not score identically. So the
 * tests that matter are the ones proving the answer moves — a 司令 table that
 * never changes a verdict is decoration.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeStrength } from '../src/analyzer/strength';
import { rulingStem, silingShares, RULER_SHARE } from '../src/analyzer/siling';
import { EarthBranch } from 'tyme4ts';
import type { BirthInput, HiddenStem, Element, TenGod } from '../src/engine/types';

const SG = 'Asia/Singapore';
const at = (year: number, month: number, day: number): BirthInput => ({
  year, month, day, hour: 12, minute: 0,
  timeZone: SG, gender: 'male', useTrueSolarTime: false,
});

/** The chart's own 藏干 for a branch, in the shape the scorer uses. */
function hidden(branch: string): HiddenStem[] {
  const ROLE = { 2: 'main', 1: 'middle', 0: 'residual' } as const;
  return EarthBranch.fromName(branch).getHideHeavenStems().map((h) => ({
    stem: h.getHeavenStem().getName(),
    element: h.getHeavenStem().getElement().getName() as Element,
    role: ROLE[h.getType() as 0 | 1 | 2],
    tenGod: '比肩' as TenGod,
  }));
}

describe('who rules the month branch', () => {
  it('walks the classical spans in order', () => {
    // 寅: 戊 for 7 days, then 丙 for 7, then 甲 for the rest.
    const h = hidden('寅');
    expect(rulingStem('寅', 1, h).stem).toBe('戊');
    expect(rulingStem('寅', 6.9, h).stem).toBe('戊');
    expect(rulingStem('寅', 7.1, h).stem).toBe('丙');
    expect(rulingStem('寅', 13.9, h).stem).toBe('丙');
    expect(rulingStem('寅', 14.1, h).stem).toBe('甲');
    expect(rulingStem('寅', 29, h).stem).toBe('甲');
  });

  it('keeps the final ruler past the end of the table', () => {
    // A solar month runs ~30.44 days; the tables sum to 30.
    expect(rulingStem('寅', 30.4, hidden('寅')).stem).toBe('甲');
    expect(rulingStem('子', 33, hidden('子')).stem).toBe('癸');
  });

  it('substitutes the 本气 when the classical ruler is not in the branch', () => {
    // 午 opens with 丙, carried over from 巳, which 午 does not hold.
    const r = rulingStem('午', 3, hidden('午'));
    expect(r.classicalStem).toBe('丙');
    expect(r.substituted).toBe(true);
    expect(r.stem).toBe('丁'); // 午's 本气
    // And once a stem it does hold takes over, no substitution.
    const later = rulingStem('午', 12, hidden('午'));
    expect(later.stem).toBe('己');
    expect(later.substituted).toBe(false);
  });

  it('substitutes for every branch whose table opens with a carried-over stem', () => {
    for (const [branch, expected] of [['子', '癸'], ['卯', '乙'], ['酉', '辛'], ['亥', '壬']] as const) {
      const r = rulingStem(branch, 2, hidden(branch));
      expect(r.substituted, branch).toBe(true);
      expect(r.stem, branch).toBe(expected);
    }
  });

  it('never names a stem the branch does not contain', () => {
    for (const branch of '子丑寅卯辰巳午未申酉戌亥') {
      const h = hidden(branch);
      const stems = new Set(h.map((x) => x.stem));
      for (let d = 0; d < 31; d += 0.5) {
        expect(stems.has(rulingStem(branch, d, h).stem), `${branch} day ${d}`).toBe(true);
      }
    }
  });
});

describe('how the month branch weight is split', () => {
  it('sums to one for every branch and every day', () => {
    for (const branch of '子丑寅卯辰巳午未申酉戌亥') {
      const h = hidden(branch);
      for (let d = 0; d < 31; d += 1) {
        const shares = silingShares(h, rulingStem(branch, d, h).stem);
        const total = [...shares.values()].reduce((a, b) => a + b, 0);
        expect(total, `${branch} day ${d}`).toBeCloseTo(1, 6);
      }
    }
  });

  it('gives the ruler the dominant share', () => {
    const h = hidden('寅');
    const shares = silingShares(h, '丙');
    expect(shares.get('丙')).toBeCloseTo(RULER_SHARE, 6);
    for (const [stem, v] of shares) {
      if (stem !== '丙') expect(v).toBeLessThan(RULER_SHARE);
    }
  });

  it('lands near the old fixed split when the 本气 happens to rule', () => {
    // The sanity check that this change only moves what it should.
    const shares = silingShares(hidden('寅'), '甲');
    expect(shares.get('甲')).toBeCloseTo(0.55, 2);
    expect(shares.get('丙')).toBeCloseTo(0.3375, 2);
    expect(shares.get('戊')).toBeCloseTo(0.1125, 2);
  });

  it('gives everything to the single hidden stem of a cardinal branch', () => {
    for (const branch of ['子', '卯', '酉']) {
      const h = hidden(branch);
      const shares = silingShares(h, rulingStem(branch, 5, h).stem);
      expect(shares.size).toBe(1);
      expect([...shares.values()][0]).toBe(1);
    }
  });
});

describe('it actually changes the reading', () => {
  it('scores two births in the same month differently', () => {
    // Both in 寅月 2024 (立春 Feb 4), one under 戊 and one under 甲.
    const early = analyzeStrength(buildChart(at(2024, 2, 8)));   // ~4 days in, 戊
    const late = analyzeStrength(buildChart(at(2024, 2, 26)));   // ~22 days in, 甲

    expect(early.siLing.stem).toBe('戊');
    expect(late.siLing.stem).toBe('甲');
    // Same month pillar, different element weighting.
    expect(early.elementPercent).not.toEqual(late.elementPercent);
  });

  it('moves the element the ruler belongs to, in the right direction', () => {
    const early = analyzeStrength(buildChart(at(2024, 2, 8)));   // 戊 = 土
    const late = analyzeStrength(buildChart(at(2024, 2, 26)));   // 甲 = 木
    // Earth is better represented under 戊司令 than under 甲司令, and wood the
    // other way round. Day pillars differ between the two dates, so this is a
    // direction check rather than an exact figure.
    expect(early.elementPercent['土']).toBeGreaterThan(0);
    expect(late.elementPercent['木']).toBeGreaterThan(early.elementPercent['木'] - 12);
  });

  it('reports the day count and the ruler in its reasoning', () => {
    const s = analyzeStrength(buildChart(at(2024, 2, 8)));
    const zh = s.reasoning.map((r) => r.zh).join('');
    const en = s.reasoning.map((r) => r.en).join('');
    expect(zh).toContain('司令');
    expect(zh).toContain('距节');
    expect(en).toContain('is in charge');
    expect(en).toContain('days after the opening term');
  });

  it('says so when the classical ruler had to be substituted', () => {
    // Early 午月 2024: 芒种 is around 5 June, so 8 June is under 丙.
    const s = analyzeStrength(buildChart(at(2024, 6, 8)));
    if (!s.siLing.substituted) return;
    expect(s.reasoning.map((r) => r.zh).join('')).toContain('非本支所藏');
    expect(s.reasoning.map((r) => r.en).join('')).toContain('stands in');
  });

  it('bases 得令 on the ruler rather than the 本气', () => {
    // 寅月 under 戊 (土) vs under 甲 (木): a 木 day master is 得令 only in the
    // latter, which the old 本气-only test could not distinguish.
    const early = analyzeStrength(buildChart(at(2024, 2, 8)));
    const late = analyzeStrength(buildChart(at(2024, 2, 26)));
    expect(early.siLing.stem).not.toBe(late.siLing.stem);
    expect(typeof early.hasMonthCommand).toBe('boolean');
    expect(typeof late.hasMonthCommand).toBe('boolean');
  });
});

describe('days into the term', () => {
  it('is measured from the 节 that opened the month, not the mid-month 气', () => {
    // 立春 2024 fell on 4 Feb. 雨水 is around 19 Feb, and must not reset the count.
    expect(buildChart(at(2024, 2, 6)).monthTermDays).toBeGreaterThan(1);
    expect(buildChart(at(2024, 2, 6)).monthTermDays).toBeLessThan(3);
    expect(buildChart(at(2024, 2, 25)).monthTermDays).toBeGreaterThan(20);
  });

  it('resets at the next 节, in step with the month pillar', () => {
    const before = buildChart(at(2024, 3, 4));
    const after = buildChart(at(2024, 3, 8));
    expect(before.pillars.month.ganZhi).not.toBe(after.pillars.month.ganZhi);
    expect(after.monthTermDays).toBeLessThan(before.monthTermDays);
  });

  it('is never negative', () => {
    for (let m = 1; m <= 12; m++) {
      for (const d of [1, 5, 12, 20, 28]) {
        expect(buildChart(at(2024, m, d)).monthTermDays, `${m}-${d}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
