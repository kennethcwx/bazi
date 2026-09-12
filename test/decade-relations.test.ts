/**
 * 大运 scored on 合冲 with the natal chart, not element favourability alone.
 *
 * The element base says whether a decade carries the 用神; 合冲 says whether it
 * is turbulent, which is often the more consequential reading. The guards here
 * check that the layer FIRES at a believable rate (a 冲 needs an exact branch
 * opposition, so ~1 in 6 decades should clash a core palace), that it stays
 * BOUNDED (it must modulate the element base, never replace it), and that every
 * point it moves is explained in a note.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { scoreElementBase } from '../src/analyzer/topics/career';
import type { BirthInput } from '../src/engine/types';

const at = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1985, month: 6, day: 15, hour: 14, minute: 0,
  timeZone: 'Asia/Shanghai', longitude: 121.47, gender: 'male',
  useTrueSolarTime: false, ...o,
});

const DECADES_WITH_CHART = (() => {
  const out = [];
  for (let year = 1945; year <= 2010; year += 3) {
    for (const month of [2, 5, 8, 11]) {
      for (const gender of ['male', 'female'] as const) {
        const chart = buildChart(at({ year, month, gender }));
        const a = analyzeChart(chart);
        for (const d of a.career.decades) out.push({ chart, yongShen: a.yongShen, decade: d });
      }
    }
  }
  return out;
})();
const DECADES = DECADES_WITH_CHART.map((x) => x.decade);

const CLASH = /冲/;
const COMBINE = /相合/;

describe('大运 合冲 layer', () => {
  it('fires at a believable rate — a core clash is roughly 1 in 6 decades', () => {
    const coreClash = DECADES.filter((d) =>
      d.notes.some((n) => /^此运.*冲.*(日支（自身|月支（提纲)/.test(n.zh)));
    const rate = coreClash.length / DECADES.length;
    // Not 0 (dead feature) and not everywhere (over-firing). ~1/6 expected.
    expect(rate).toBeGreaterThan(0.08);
    expect(rate, `core-clash rate ${(rate * 100).toFixed(1)}%`).toBeLessThan(0.28);
  });

  it('both 合 and 冲 actually occur across the sweep', () => {
    expect(DECADES.some((d) => d.notes.some((n) => CLASH.test(n.zh)))).toBe(true);
    expect(DECADES.some((d) => d.notes.some((n) => COMBINE.test(n.zh)))).toBe(true);
  });

  it('stays bounded: the score never leaves the element base ± the relation cap', () => {
    // Element base is -4..+4 (用 +2 / 忌 −2 / 闲 0 per character), minus 旬空;
    // the 合冲 cap is ±2.
    for (const d of DECADES) {
      expect(d.score).toBeGreaterThanOrEqual(-7);
      expect(d.score).toBeLessThanOrEqual(6);
    }
  });

  it('keeps all four verdicts reachable', () => {
    const seen = new Set(DECADES.map((d) => d.verdict));
    for (const v of ['有利', '偏顺', '平稳', '不利']) {
      expect(seen.has(v as never), `${v} never occurs`).toBe(true);
    }
  });

  it('never scores a 冲 to the outer 年/时 branches — those are named, not scored', () => {
    // An outer clash carries the "边角有触动" wording and moves nothing; a core
    // clash carries "主动荡变迁". This is the one that could silently double-count.
    for (const { chart, yongShen, decade: d } of DECADES_WITH_CHART) {
      const outer = d.notes.find((n) => /边角有触动/.test(n.zh));
      if (!outer) continue;
      // If the ONLY relation note is an outer clash, the score must equal the
      // pure element base (recomputed here) less 旬空 — no relation delta.
      const relNotes = d.notes.filter((n) => CLASH.test(n.zh) || COMBINE.test(n.zh) || /半合|相刑|相害|相破/.test(n.zh));
      if (relNotes.length === 1) {
        const natal = chart.decades[d.index]!;
        const base = scoreElementBase(natal.stem, natal.branch, yongShen).score;
        expect(d.score).toBe(base - (natal.isVoid ? 1 : 0));
      }
    }
  });
});
