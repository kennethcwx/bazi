/**
 * 格局法 beside 扶抑 — the second 用神 lens.
 *
 * It is a reference, not a ruling: 扶抑 stays what the scoring runs on. These
 * guards pin the textbook rules (顺用 / 逆用 and what each 格 wants), the
 * strength adjustments 子平真诠 makes, the agreement verdict against 扶抑,
 * and that the divergence is real but not total across a sweep of charts —
 * a lens that always agreed would be saying nothing, one that never agreed
 * would be broken.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { familyElement } from '../src/analyzer/elements';
import type { BirthInput } from '../src/engine/types';

const at = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1985, month: 6, day: 15, hour: 14, minute: 0,
  timeZone: 'Asia/Shanghai', longitude: 121.47, gender: 'male',
  useTrueSolarTime: false, ...o,
});

const SWEEP = (() => {
  const out = [];
  for (let year = 1945; year <= 2010; year += 2) {
    for (const month of [1, 4, 7, 10]) {
      for (const gender of ['male', 'female'] as const) {
        out.push(analyzeChart(buildChart(at({ year, month, gender }))));
      }
    }
  }
  return out;
})();

describe('格局法 lens', () => {
  it('names the same 格 the career reading uses', () => {
    for (const a of SWEEP) expect(a.structureLens.structure).toBe(a.career.structure);
  });

  it('吉神 are 顺用 and 凶神 are 逆用', () => {
    for (const a of SWEEP) {
      const g = a.structureLens.tenGod;
      const expected = ['正官', '正财', '偏财', '正印', '偏印', '食神'].includes(g) ? '顺用' : '逆用';
      expect(a.structureLens.method, `${g}`).toBe(expected);
    }
  });

  it('wants and fears are elements of the named families, and never overlap', () => {
    for (const a of SWEEP) {
      const dm = a.chart.dayMasterElement;
      const l = a.structureLens;
      expect(l.wants).toEqual([...new Set(l.wantsFamilies.map((f) => familyElement(dm, f)))]);
      expect(l.fears).toEqual([...new Set(l.fearsFamilies.map((f) => familyElement(dm, f)))]);
      for (const e of l.wants) expect(l.fears).not.toContain(e);
    }
  });

  it('a weak day master under a 财/官/杀/食伤 格 is propped up first', () => {
    const weak = SWEEP.filter((a) =>
      a.strength.verdict === '身弱'
      && ['正官', '正财', '偏财', '食神', '伤官', '七杀'].includes(a.structureLens.tenGod));
    expect(weak.length).toBeGreaterThan(0);
    for (const a of weak) {
      expect(a.structureLens.wantsFamilies).toEqual(['印', '比劫']);
      expect(a.structureLens.reasoning.some((r) => /先取印、比劫扶身/.test(r.zh))).toBe(true);
    }
  });

  it('a strong day master under an 印格 turns to spending', () => {
    const strongYin = SWEEP.filter((a) =>
      a.strength.verdict === '身强' && ['正印', '偏印'].includes(a.structureLens.tenGod));
    for (const a of strongYin) {
      expect(a.structureLens.wantsFamilies).toEqual(['财', '食伤']);
    }
  });

  it('the agreement verdict follows the 扶抑 lists', () => {
    for (const a of SWEEP) {
      const fav = new Set(a.yongShen.favourable);
      const unfav = new Set(a.yongShen.unfavourable);
      const inFav = a.structureLens.wants.filter((e) => fav.has(e)).length;
      const inUnfav = a.structureLens.wants.filter((e) => unfav.has(e)).length;
      const expected = inFav > 0 && inUnfav === 0 ? 'agree' : inFav > 0 ? 'partial' : 'differ';
      expect(a.structureLens.agreement).toBe(expected);
      const last = a.structureLens.reasoning.at(-1)!.zh;
      if (expected === 'differ') expect(last.startsWith('⚠️')).toBe(true);
      else expect(last.startsWith('⚠️')).toBe(false);
    }
  });

  it('the two schools agree on some charts and differ on others', () => {
    const count = (v: string) => SWEEP.filter((a) => a.structureLens.agreement === v).length / SWEEP.length;
    expect(count('agree')).toBeGreaterThan(0.15);
    expect(count('differ')).toBeGreaterThan(0.1);
    expect(count('differ')).toBeLessThan(0.6);
  });

  it('every reasoning line is bilingual', () => {
    for (const a of SWEEP.slice(0, 20)) {
      for (const r of a.structureLens.reasoning) {
        expect(r.zh.length).toBeGreaterThan(0);
        expect(r.en.length).toBeGreaterThan(0);
      }
    }
  });
});
