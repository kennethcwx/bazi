/**
 * 旺衰 counting 刑冲合会, and 格局 by 月令人元透干.
 *
 * Both changes move verdicts on real charts, so the guards here are of two
 * kinds. The narrow ones pin a hand-checked chart. The sweeps assert that every
 * verdict and every 格局 name is still *reachable* — a scored feature whose
 * top band never fires measures nothing, and this repo has shipped that bug
 * twice already (career.timing.none, and the joint hour `good` band at 0 of
 * 720). A range check is the only thing that catches it.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart, ANALYZER_VERSION } from '../src/analyzer/index';
import { analyzeStrength } from '../src/analyzer/strength';
import { __cacheKeyForTest } from '../src/narrator/narrate';
import { STRUCTURE } from '../src/i18n/glossary';
import type { BirthInput } from '../src/engine/types';

const CN = 'Asia/Shanghai';
const at = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 0,
  timeZone: CN, longitude: 116.4, gender: 'male', useTrueSolarTime: false, ...o,
});
const chartAt = (o: Partial<BirthInput> = {}) => buildChart(at(o));

/**
 * Deterministic spread wide enough that a dead branch shows up as a zero.
 *
 * Built and analysed ONCE at module load. `analyzeChart` runs a 44-year 流年
 * window scan, so re-sweeping per test costs minutes rather than seconds.
 */
const SWEEP = (() => {
  const charts = [];
  for (let year = 1930; year <= 2020; year += 9) {
    for (let month = 1; month <= 12; month++) {
      for (const day of [8, 23]) {
        for (const hour of [4, 16]) {
          charts.push(chartAt({ year, month, day, hour }));
        }
      }
    }
  }
  return charts;
})();

const STRENGTHS = SWEEP.map((c) => analyzeStrength(c));
const ANALYSES = SWEEP.map((c) => analyzeChart(c));


describe('旺衰 counts 刑冲合会', () => {
  // 庚午 戊寅 癸巳 辛酉. Hand-checked: 寅午半合火, 巳酉半合金, 寅巳相害.
  const c = chartAt({ year: 1930, month: 2, day: 12, hour: 17 });

  it('discounts every branch a relation actually lands on', () => {
    const s = analyzeStrength(c);
    const byBranch = Object.fromEntries(
      s.relationAdjustments.map((a) => [a.branch, a]),
    );
    expect(Object.keys(byBranch).sort()).toEqual(['午', '巳', '寅', '酉'].sort());
    // 寅 and 巳 each take two relations, 午 and 酉 one — so the pairs differ.
    expect(byBranch['寅']!.factor).toBeLessThan(byBranch['午']!.factor);
    expect(byBranch['巳']!.factor).toBeLessThan(byBranch['酉']!.factor);
  });

  it('reports what the adjustment moved, rather than only that it happened', () => {
    const s = analyzeStrength(c);
    expect(s.supportPercentBeforeRelations).not.toBe(s.supportPercent);
    const zh = s.reasoning.map((r) => r.zh).join('\n');
    expect(zh).toContain('寅午半合火');
    expect(zh).toContain(`${s.supportPercentBeforeRelations}%`);
    expect(zh).toContain(`${s.supportPercent}%`);
  });

  it('names every adjustment in both languages', () => {
    const s = analyzeStrength(c);
    for (const a of s.relationAdjustments) {
      const zh = s.reasoning.map((r) => r.zh).join('\n');
      const en = s.reasoning.map((r) => r.en).join('\n');
      expect(zh).toContain(a.branch);
      expect(en).toContain(a.branch);
    }
  });

  // NEGATIVE CONTROL. Without this the discount could be firing on every chart
  // and the tests above would read exactly the same.
  it('leaves a chart with no branch relations completely alone', () => {
    let untouched = 0;
    for (const s of STRENGTHS) {
      if (s.relationAdjustments.length === 0) {
        untouched++;
        expect(s.supportPercentBeforeRelations).toBe(s.supportPercent);
      }
    }
    expect(untouched).toBeGreaterThan(0);
  });

  it('never lets relations run away with a branch', () => {
    for (const s of STRENGTHS) {
      for (const a of s.relationAdjustments) {
        expect(a.factor).toBeGreaterThanOrEqual(0.65);
        expect(a.factor).toBeLessThan(1);
      }
    }
  });

  it('keeps 五行% summing to exactly 100 after adjustment', () => {
    for (const s of STRENGTHS) {
      const sum = Object.values(s.elementPercent).reduce((a, b) => a + b, 0);
      expect(Math.round(sum * 10) / 10).toBe(100);
    }
  });

  it('is deterministic', () => {
    const a = analyzeStrength(chartAt({ year: 1975, month: 8, day: 8, hour: 16 }));
    const b = analyzeStrength(chartAt({ year: 1975, month: 8, day: 8, hour: 16 }));
    expect(b.supportPercent).toBe(a.supportPercent);
    expect(b.verdict).toBe(a.verdict);
  });

  it('still reaches all three verdicts', () => {
    const seen = new Set<string>();
    for (const s of STRENGTHS) seen.add(s.verdict);
    // Membership, not order — Array.sort on CJK orders by UTF-16 code unit.
    for (const v of ['身强', '中和', '身弱']) expect(seen.has(v)).toBe(true);
  });
});

describe('格局 by 月令人元透干', () => {
  it('takes the exposed 人元 over the 本气', () => {
    // 庚午 戊寅 癸巳 辛酉. 寅 holds 甲(本)丙(中)戊(余); visible stems are
    // 庚 戊 辛, so only the 余气 戊 is 透 — 正官格, not the 本气's 伤官格.
    const a = analyzeChart(chartAt({ year: 1930, month: 2, day: 12, hour: 17 }));
    expect(a.chart.pillars.month.branch).toBe('寅');
    expect(a.career.structure).toBe('正官格');
    expect(a.career.structureExposed).toBe(true);
  });

  it('falls back to the 本气 when nothing is exposed', () => {
    let checked = 0;
    for (const a of ANALYSES) {
      if (a.career.structureExposed) continue;
      const chart = a.chart;
      const main = chart.pillars.month.hiddenStems.find((h) => h.role === 'main')!;
      const expected =
        main.tenGod === '比肩' ? '建禄格'
        : main.tenGod === '劫财' ? (chart.dayMasterYinYang === '阳' ? '羊刃格' : '月劫格')
        : `${main.tenGod}格`;
      expect(a.career.structure).toBe(expected);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('names 禄刃 from the 月令, even when a 财官 is transparent (建禄 precedence)', () => {
    // The bug this guards: 禄刃 are month-COMMAND patterns. When the 月令本气 is
    // the Day Master's 禄 (比肩) or 刃 (劫财), the pattern is 建禄/羊刃/月劫 — and
    // the Day Master is excluded from the 透干 count, so a transparent 中气 财官
    // used to win and mislabel the chart (丙日巳月 → 偏财格 instead of 建禄格).
    let lu = 0, luWithTransparentOther = 0, blade = 0;
    for (const a of ANALYSES) {
      const chart = a.chart;
      const main = chart.pillars.month.hiddenStems.find((h) => h.role === 'main')!;
      const visible = [
        chart.pillars.year.stem, chart.pillars.month.stem,
        ...(chart.pillars.hour ? [chart.pillars.hour.stem] : []),
      ];
      const transparentOther = chart.pillars.month.hiddenStems.some(
        (h) => h.role !== 'main' && visible.includes(h.stem)
          && h.tenGod !== '比肩' && h.tenGod !== '劫财',
      );
      if (main.tenGod === '比肩') {
        expect(a.career.structure).toBe('建禄格');
        lu++;
        if (transparentOther) luWithTransparentOther++;
      }
      if (main.tenGod === '劫财') {
        expect(a.career.structure).toBe(chart.dayMasterYinYang === '阳' ? '羊刃格' : '月劫格');
        blade++;
      }
    }
    expect(lu, '建禄 never occurred').toBeGreaterThan(0);
    expect(blade, '羊刃/月劫 never occurred').toBeGreaterThan(0);
    // The precedence case must actually be exercised or the guard proves nothing.
    expect(luWithTransparentOther,
      '建禄 with a transparent 财官 never occurred — precedence untested').toBeGreaterThan(0);
  });

  it('丙日巳月 with a transparent 偏财 is 建禄格 (regression, a real birth)', () => {
    // 1994-05-10 04:47 Singapore, true solar → 甲戌 己巳 丙申 庚寅. 巳 本气 丙 is
    // 丙's 禄; the 中气 庚 (偏财) is transparent in the hour stem. Before v6 this
    // was mislabelled 偏财格. Cross-checked 4/4 against an independent engine.
    const c = buildChart({
      year: 1994, month: 5, day: 10, hour: 4, minute: 47,
      timeZone: 'Asia/Singapore', longitude: 103.82, gender: 'male', useTrueSolarTime: true,
    });
    const pillars = [c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour]
      .map((p) => p!.ganZhi).join(' ');
    expect(pillars).toBe('甲戌 己巳 丙申 庚寅'); // guard the fixture itself
    expect(analyzeChart(c).career.structure).toBe('建禄格');
  });

  it('never counts the 日干 as an exposure', () => {
    // The day stem is the subject. If it counted, a chart whose 月令 hides the
    // day master's own stem would name a 格 off the thing being measured.
    for (const a of ANALYSES) {
      const chart = a.chart;
      if (!a.career.structureExposed) continue;
      const visible = [
        chart.pillars.year.stem,
        chart.pillars.month.stem,
        ...(chart.pillars.hour ? [chart.pillars.hour.stem] : []),
      ];
      const exposedHidden = chart.pillars.month.hiddenStems
        .filter((h) => visible.includes(h.stem));
      expect(exposedHidden.length).toBeGreaterThan(0);
    }
  });
});

describe('羊刃 is a 阳干 phenomenon', () => {
  it('never gives a 阴干 day master 羊刃格, nor a 阳干 月劫格', () => {
    let yang = 0, yin = 0;
    for (const a of ANALYSES) {
      if (a.career.structure === '羊刃格') {
        expect(a.chart.dayMasterYinYang).toBe('阳');
        yang++;
      }
      if (a.career.structure === '月劫格') {
        expect(a.chart.dayMasterYinYang).toBe('阴');
        yin++;
      }
    }
    // Both must actually occur, or the assertions above proved nothing.
    expect(yang).toBeGreaterThan(0);
    expect(yin).toBeGreaterThan(0);
  });

  it('every 格局 name it can emit is reachable and has a glossary entry', () => {
    const seen = new Set<string>();
    for (const a of ANALYSES) seen.add(a.career.structure);
    expect(seen.size).toBe(11);
    for (const name of seen) expect(STRUCTURE[name]).toBeDefined();
  });
});

describe('reading cache', () => {
  it('keys on the analyzer version', () => {
    // chartHash covers L1 only. Without this the cache serves prose grounded
    // in findings that have since moved — citations that no longer match.
    const analysis = analyzeChart(chartAt());
    const key = __cacheKeyForTest(
      analysis, { id: 'x' } as never, 'zh' as never, 'composed' as never,
    );
    expect(key).toContain(ANALYZER_VERSION);
  });
});
