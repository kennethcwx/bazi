/**
 * 流月 and the stacking of 流年 / 流月 over a 流日.
 *
 * The month is read on the decade scale — same element base, same 合冲
 * scorer — so the strip under the 流年 band cannot disagree with the row above
 * it for no reason a reader could follow. The stacking is said, not scored: a
 * day keeps its band whether or not the layers are passed in, and only a day
 * that already registers can land on a layer.
 */

import { describe, it, expect } from 'vitest';
import { buildChart, monthlyLuck, sexagenaryYearOf, transitPillars } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { scoreMonths } from '../src/analyzer/topics/monthly';
import { favourOf, forecastRelationship, layersOf, scoreDay } from '../src/analyzer/topics/forecast';
import { readPalaceLayer, stackedOn } from '../src/analyzer/topics/dayread';
import type { BirthInput } from '../src/engine/types';

const at = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1985, month: 6, day: 15, hour: 14, minute: 0,
  timeZone: 'Asia/Shanghai', longitude: 121.47, gender: 'male',
  useTrueSolarTime: false, ...o,
});

/** 五虎遁: the year stem fixes the stem of the 寅 month. */
const FIRST_MONTH_STEM: Record<string, string> = {
  甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲',
};
const BRANCHES = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

describe('流月 — the engine', () => {
  const chart = buildChart(at());

  it('gives twelve months, 寅 to 丑, opening at 立春', () => {
    const m = monthlyLuck(chart, 2026);
    expect(m).toHaveLength(12);
    expect(m.map((x) => x.branch)).toEqual(BRANCHES);
    expect(m[0]!.starts.month).toBe(2);
    expect(m[0]!.starts.day).toBeGreaterThanOrEqual(3);
    expect(m[0]!.starts.day).toBeLessThanOrEqual(5);
  });

  it('follows 五虎遁 for the 寅 month stem, and the last month opens in the next civil year', () => {
    for (const y of [2024, 2025, 2026, 2027, 2031]) {
      const yearStem = transitPillars(y, 6, 1).year.getHeavenStem().getName();
      const m = monthlyLuck(chart, y);
      expect(m[0]!.stem, `${y} 寅月`).toBe(FIRST_MONTH_STEM[yearStem]);
      expect(m[11]!.starts.year).toBe(y + 1);
      expect(m[11]!.starts.month).toBe(1);
    }
  });

  it('places a date before 立春 in the previous 流年', () => {
    expect(sexagenaryYearOf(2026, 1, 20)).toBe(2025);
    expect(sexagenaryYearOf(2026, 2, 10)).toBe(2026);
    expect(sexagenaryYearOf(2026, 12, 31)).toBe(2026);
  });

  it('reads each month against the day master', () => {
    const m = monthlyLuck(chart, 2026);
    // 1985-06-15 14:00 Shanghai: the day master is fixed; the ten gods must
    // be a function of the month's own stem and branch, so no two months with
    // different stems share a stem ten god by accident.
    const godsByStem = new Map<string, string>();
    for (const x of m) {
      const seen = godsByStem.get(x.stem);
      if (seen) expect(seen).toBe(x.stemTenGod);
      godsByStem.set(x.stem, x.stemTenGod);
    }
  });
});

describe('流月 — the scorer', () => {
  const sweep = (() => {
    const out = [];
    for (let year = 1950; year <= 2005; year += 5) {
      for (const gender of ['male', 'female'] as const) {
        const chart = buildChart(at({ year, gender }));
        const a = analyzeChart(chart);
        out.push(...scoreMonths(chart, a.yongShen, 2026));
      }
    }
    return out;
  })();

  it('scores on the decade scale and stays bounded', () => {
    for (const m of sweep) {
      expect(['有利', '偏顺', '平稳', '不利']).toContain(m.verdict);
      expect(m.score).toBeGreaterThanOrEqual(-6);   // base −4, 合冲 −2
      expect(m.score).toBeLessThanOrEqual(6);
      expect(m.notes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('names the month, not the decade, in its 合冲 notes', () => {
    const rel = sweep.flatMap((m) => m.notes).filter((n) => /冲|相合|相刑/.test(n.zh));
    expect(rel.length).toBeGreaterThan(0);
    for (const n of rel) {
      expect(n.zh.startsWith('此月')).toBe(true);
      expect(n.zh).not.toContain('此运');
      expect(n.en.startsWith('This month')).toBe(true);
    }
  });

  it('all four verdicts occur across the sweep', () => {
    const seen = new Set(sweep.map((m) => m.verdict));
    for (const v of ['有利', '偏顺', '平稳', '不利']) expect(seen.has(v as never), v).toBe(true);
  });
});

describe('stacking 流年 / 流月 over a day', () => {
  it('a layer that clashes the palace registers with the clash mode', () => {
    // Day branch 子; a 午 month clashes it.
    const chart = buildChart(at({ day: 18 }));   // 戊子 day
    expect(chart.pillars.day.branch).toBe('子');
    const month = readPalaceLayer(chart, { stem: '甲', branch: '午' }, '流月');
    expect(month.mode).toBe('friction');
    expect(month.notes[0]!.zh.startsWith('流月甲午')).toBe(true);
    const quiet = readPalaceLayer(chart, { stem: '甲', branch: '寅' }, '流月');
    expect(quiet.mode).toBe('quiet');
    expect(quiet.notes).toHaveLength(0);
  });

  it('a quiet day stacks on nothing, even under a loud month', () => {
    const chart = buildChart(at({ day: 18 }));   // 戊子 day
    const month = readPalaceLayer(chart, { stem: '甲', branch: '午' }, '流月');
    expect(stackedOn('quiet', [month])).toEqual([]);
    expect(stackedOn('friction', [month])).toEqual(['流月']);
    expect(stackedOn('close', [month])).toEqual([]);
  });

  it('the layers never move a day\'s score or band', () => {
    for (let year = 1950; year <= 2005; year += 5) {
      const chart = buildChart(at({ year }));
      const favour = favourOf(chart);
      const from = Date.UTC(2026, 8, 1);
      const layers = layersOf(chart, new Date(from + 15 * 86_400_000));
      for (let i = 0; i < 30; i++) {
        const date = new Date(from + i * 86_400_000);
        const bare = scoreDay(chart, date, favour);
        const stacked = scoreDay(chart, date, favour, layers);
        expect(stacked.score).toBe(bare.score);
        expect(stacked.band).toBe(bare.band);
        expect(stacked.mode).toBe(bare.mode);
        if (stacked.stacked.length) {
          expect(stacked.band).not.toBe('quiet');
          expect(stacked.notes.at(-1)!.zh).toMatch(/再叠一层/);
        } else {
          expect(stacked.notes).toEqual(bare.notes);
        }
      }
    }
  });

  it('the forecast carries its layers and some days do stack across a sweep', () => {
    let stackedDays = 0;
    for (let year = 1950; year <= 2005; year += 5) {
      const chart = buildChart(at({ year }));
      const f = forecastRelationship(chart, new Date(Date.UTC(2026, 8, 1)), 30);
      expect(f.layers.year.layer).toBe('流年');
      expect(f.layers.month.layer).toBe('流月');
      expect(f.layers.year.ganZhi).toBe('丙午');
      stackedDays += f.days.filter((d) => d.stacked.length > 0).length;
    }
    expect(stackedDays).toBeGreaterThan(0);
  });
});
