/**
 * The element base of a luck pillar: 用 +2 / 忌 −2 / 闲 0 per character.
 *
 * The old base scored every non-用神 character −1. Only two of five elements
 * are ever favourable, so three of five pillars were "unfavourable" before a
 * single 合冲 was read, and the whole timeline leaned negative by
 * construction. These guards pin the three classes and check the timeline no
 * longer leans: across a sweep of charts the median decade should sit at
 * 平稳, not below it, and 不利 should be the minority it classically is.
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

// A 用神 木 / 忌神 金 split, hand-picked so each class is exercised by name.
const YS = { favourable: ['木', '火'] as const, unfavourable: ['金', '土'] as const };

describe('element base — three classes', () => {
  it('a 用神 character scores +2 and says so', () => {
    const r = scoreElementBase('甲', '寅', YS);      // 木 / 木
    expect(r.score).toBe(4);
    expect(r.notes.every((n) => /用神一路/.test(n.zh))).toBe(true);
  });

  it('a 忌神 character scores −2 and is named as 忌神', () => {
    const r = scoreElementBase('庚', '申', YS);      // 金 / 金
    expect(r.score).toBe(-4);
    expect(r.notes.every((n) => /是忌神/.test(n.zh))).toBe(true);
  });

  it('a 闲神 character scores 0 — neither help nor harm', () => {
    const r = scoreElementBase('壬', '子', YS);      // 水 / 水: neither list
    expect(r.score).toBe(0);
    expect(r.notes.every((n) => /闲神/.test(n.zh))).toBe(true);
  });

  it('用 with 忌 cancels to 0, not +1', () => {
    expect(scoreElementBase('甲', '申', YS).score).toBe(0);
  });

  it('用 with 闲 is +2, 忌 with 闲 is −2', () => {
    expect(scoreElementBase('甲', '子', YS).score).toBe(2);
    expect(scoreElementBase('庚', '子', YS).score).toBe(-2);
  });
});

describe('element base — the timeline no longer leans negative', () => {
  const decades = (() => {
    const out = [];
    for (let year = 1945; year <= 2010; year += 3) {
      for (const month of [2, 5, 8, 11]) {
        for (const gender of ['male', 'female'] as const) {
          out.push(...analyzeChart(buildChart(at({ year, month, gender }))).career.decades);
        }
      }
    }
    return out;
  })();

  it('the median decade sits at 平稳 or better', () => {
    const scores = decades.map((d) => d.score).sort((a, b) => a - b);
    const median = scores[Math.floor(scores.length / 2)]!;
    expect(median, `median score ${median}`).toBeGreaterThanOrEqual(-2);
  });

  it('roughly a quarter of decades on each side, half in the middle', () => {
    const count = (v: string) => decades.filter((d) => d.verdict === v).length;
    const bad = count('不利') / decades.length;
    const good = (count('有利') + count('偏顺')) / decades.length;
    const mid = count('平稳') / decades.length;
    expect(bad, `不利 rate ${(bad * 100).toFixed(1)}%`).toBeLessThan(0.3);
    expect(good, `good side ${(good * 100).toFixed(1)}% vs 不利 ${(bad * 100).toFixed(1)}%`)
      .toBeGreaterThanOrEqual(bad * 0.8);
    expect(mid, `平稳 ${(mid * 100).toFixed(1)}%`).toBeGreaterThan(0.4);
  });

  it('a two-闲 decade with no 合冲 reads 平稳, never 不利', () => {
    const flat = decades.filter((d) =>
      d.notes.filter((n) => /闲神/.test(n.zh)).length === 2
      && !d.notes.some((n) => /冲|相刑|自刑|空亡/.test(n.zh)));
    expect(flat.length).toBeGreaterThan(0);
    for (const d of flat) expect(d.verdict).not.toBe('不利');
  });
});
