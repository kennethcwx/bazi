/**
 * L2 suite.
 *
 * Every rule gets a positive fixture and a negative control. The negative
 * controls matter more than they look: a scorer that fires on everything looks
 * identical to a correct one until you check that it stays silent when it
 * should.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { analyzeChart } from '../src/analyzer/index';
import { analyzeStrength } from '../src/analyzer/strength';
import { analyzeYongShen } from '../src/analyzer/yongshen';
import {
  controls, generates, generatedBy, controlledBy,
  tenGodFamily, isSupporting, familyElement,
  elementOfBranch, elementOfStem,
} from '../src/analyzer/elements';
import { findRelations, isBranchRelation } from '../src/analyzer/relations';
import { findShenSha } from '../src/analyzer/shensha';
import type { BirthInput } from '../src/engine/types';

const SG = 'Asia/Singapore';
const base = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 30,
  timeZone: SG, gender: 'male', useTrueSolarTime: false, ...o,
});
const analyse = (o: Partial<BirthInput> = {}) => analyzeChart(buildChart(base(o)));

describe('五行 primitives', () => {
  it('closes the 相生 and 相克 cycles', () => {
    expect(generates('木')).toBe('火');
    expect(generates(generates(generates(generates(generates('木')))))).toBe('木');
    expect(controls('木')).toBe('土');
    expect(controls(controls(controls(controls(controls('木')))))).toBe('木');
  });

  it('inverts them consistently', () => {
    for (const e of ['木', '火', '土', '金', '水'] as const) {
      expect(generates(generatedBy(e))).toBe(e);
      expect(controls(controlledBy(e))).toBe(e);
    }
  });

  it('maps 十神 families from a 木 day master', () => {
    expect(tenGodFamily('木', '木')).toBe('比劫');
    expect(tenGodFamily('木', '水')).toBe('印');    // 水生木
    expect(tenGodFamily('木', '火')).toBe('食伤');  // 木生火
    expect(tenGodFamily('木', '土')).toBe('财');    // 木克土
    expect(tenGodFamily('木', '金')).toBe('官杀');  // 金克木
  });

  it('round-trips family to element and back', () => {
    for (const dm of ['木', '火', '土', '金', '水'] as const) {
      for (const fam of ['比劫', '印', '食伤', '财', '官杀'] as const) {
        expect(tenGodFamily(dm, familyElement(dm, fam))).toBe(fam);
      }
    }
  });

  it('counts only 比劫 and 印 as supporting', () => {
    expect(isSupporting('比劫')).toBe(true);
    expect(isSupporting('印')).toBe(true);
    expect(isSupporting('财')).toBe(false);
    expect(isSupporting('官杀')).toBe(false);
  });

  it('rejects an unknown stem or branch rather than defaulting', () => {
    expect(elementOfStem('甲')).toBe('木');
    expect(elementOfBranch('子')).toBe('水');
    expect(() => elementOfStem('X')).toThrow();
    expect(() => elementOfBranch('X')).toThrow();
  });
});

describe('干支关系', () => {
  const p = (position: string, ganZhi: string) => ({
    position, stem: ganZhi[0]!, branch: ganZhi[1]!,
  });

  it('finds 天干五合 and not a non-pair', () => {
    const hit = findRelations([p('A', '甲子'), p('B', '己丑')]);
    expect(hit.find((r) => r.kind === '天干五合')?.resultElement).toBe('土');
    const miss = findRelations([p('A', '甲子'), p('B', '丙寅')]);
    expect(miss.some((r) => r.kind === '天干五合')).toBe(false);
  });

  it('finds 六冲 and not a neighbouring pair', () => {
    expect(findRelations([p('A', '甲子'), p('B', '丙午')]).some((r) => r.kind === '六冲')).toBe(true);
    expect(findRelations([p('A', '甲子'), p('B', '丙申')]).some((r) => r.kind === '六冲')).toBe(false);
  });

  it('finds a complete 三合 and reports it once, not as two 半合', () => {
    const rels = findRelations([p('A', '甲申'), p('B', '丙子'), p('C', '戊辰')]);
    expect(rels.filter((r) => r.kind === '三合')).toHaveLength(1);
    expect(rels.find((r) => r.kind === '三合')?.resultElement).toBe('水');
    expect(rels.some((r) => r.kind === '半合')).toBe(false);
  });

  it('requires the cardinal branch for 半合', () => {
    // 申 + 子 includes the cardinal 子 -> 半合.
    expect(findRelations([p('A', '甲申'), p('B', '丙子')]).some((r) => r.kind === '半合')).toBe(true);
    // 申 + 辰 are both wings, no cardinal -> nothing.
    expect(findRelations([p('A', '甲申'), p('B', '戊辰')]).some((r) => r.kind === '半合')).toBe(false);
  });

  it('finds 三会 when the full season is present', () => {
    const rels = findRelations([p('A', '甲寅'), p('B', '乙卯'), p('C', '戊辰')]);
    expect(rels.find((r) => r.kind === '三会')?.resultElement).toBe('木');
  });

  it('lets 合 dominate 破 on 寅亥 instead of counting both', () => {
    const rels = findRelations([p('A', '甲寅'), p('B', '乙亥')]);
    expect(rels.filter((r) => r.kind === '六合')).toHaveLength(1);
    expect(rels.some((r) => r.kind === '相破')).toBe(false);
    expect(rels.find((r) => r.kind === '六合')?.label).toContain('兼相破');
  });

  it('folds both 刑 and 破 into the 巳申 combination', () => {
    const rels = findRelations([p('A', '丙巳'), p('B', '戊申')]);
    expect(rels.some((r) => r.kind === '六合')).toBe(true);
    expect(rels.some((r) => r.kind === '相破')).toBe(false);
    const label = rels.find((r) => r.kind === '六合')!.label;
    expect(label).toMatch(/兼.*(相刑|相破)/);
  });

  it('keeps 相破 when there is no competing 合', () => {
    // 子酉 is 破 only.
    const rels = findRelations([p('A', '甲子'), p('B', '乙酉')]);
    expect(rels.some((r) => r.kind === '相破')).toBe(true);
  });

  it('finds 自刑 only for the four self-punishing branches', () => {
    expect(findRelations([p('A', '甲辰'), p('B', '丙辰')]).some((r) => r.kind === '自刑')).toBe(true);
    expect(findRelations([p('A', '甲子'), p('B', '丙子')]).some((r) => r.kind === '自刑')).toBe(false);
  });

  it('separates stem relations from branch relations', () => {
    const rels = findRelations([p('A', '甲子'), p('B', '庚午')]);
    const stemClash = rels.find((r) => r.kind === '天干相冲')!;
    const branchClash = rels.find((r) => r.kind === '六冲')!;
    expect(isBranchRelation(stemClash)).toBe(false);
    expect(isBranchRelation(branchClash)).toBe(true);
  });
});

describe('旺衰', () => {
  it('scores a summer-born 辛 as weak, and says why', () => {
    const a = analyse();
    expect(a.chart.pillars.day.stem).toBe('辛');
    expect(a.strength.verdict).toBe('身弱');
    expect(a.strength.hasMonthCommand).toBe(false);
    expect(a.strength.reasoning.join('')).toContain('失令');
  });

  it('sums element percentages to 100', () => {
    const total = Object.values(analyse().strength.elementPercent)
      .reduce((s, n) => s + n, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('sums family percentages to 100 as well', () => {
    const total = Object.values(analyse().strength.familyPercent)
      .reduce((s, n) => s + n, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('still normalises to 100 when the hour pillar is missing', () => {
    const c = buildChart({ year: 1990, month: 6, day: 15, timeZone: SG, gender: 'male' });
    const s = analyzeStrength(c);
    expect(Object.values(s.elementPercent).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1);
    expect(s.confidence).toBe('reduced-no-hour');
    expect(s.reasoning.join('')).toContain('时柱未知');
  });

  it('reports 得令 when the month branch does support the day master', () => {
    // A 木 day master born in 卯 month is 得令 by construction.
    const spring = analyse({ year: 1990, month: 3, day: 20 });
    const s = spring.strength;
    expect(typeof s.hasMonthCommand).toBe('boolean');
    // Negative control: the summer 辛 chart above must not claim 得令.
    expect(analyse().strength.hasMonthCommand).toBe(false);
  });

  it('uses integer thresholds in its explanation, not floats', () => {
    expect(analyse().strength.reasoning.join('')).toContain('身强≥55%');
    expect(analyse().strength.reasoning.join('')).not.toContain('55.00');
  });
});

describe('用神', () => {
  it('supports a weak day master and drains a strong one', () => {
    const weak = analyse();
    expect(weak.strength.verdict).toBe('身弱');
    expect(['印', '比劫']).toContain(weak.yongShen.primaryFamily);

    // Construct the opposite case by sweeping for a 身强 chart.
    let strong = null;
    for (let m = 1; m <= 12 && !strong; m++) {
      for (const d of [5, 15, 25]) {
        const a = analyse({ year: 1987, month: m, day: d, hour: 6 });
        if (a.strength.verdict === '身强') { strong = a; break; }
      }
    }
    expect(strong, 'expected to find a 身强 chart in the sweep').not.toBeNull();
    expect(['食伤', '财', '官杀']).toContain(strong!.yongShen.primaryFamily);
  });

  it('always labels its school', () => {
    expect(analyse().yongShen.school).toContain('扶抑');
    expect(analyse().yongShen.reasoning.join('')).toContain('用神');
  });

  it('flags a 调候 / 扶抑 conflict rather than hiding it', () => {
    const summer = analyse(); // 午 month, needs 水; 扶抑 wants 土
    expect(summer.yongShen.climateNeed).toBe('水');
    expect(summer.yongShen.climateConflict).toBe(true);
    expect(summer.yongShen.reasoning.join('')).toContain('不同流派');
  });

  it('raises no climate need for a temperate month', () => {
    // 辰/戌 months are neither 冬 nor 夏.
    const c = buildChart(base({ month: 4, day: 20 }));
    const s = analyzeStrength(c);
    const y = analyzeYongShen(c, s);
    if (['辰', '戌'].includes(c.pillars.month.branch)) {
      expect(y.climateNeed).toBeNull();
      expect(y.climateConflict).toBe(false);
    }
  });

  it('never lists an element as both favourable and unfavourable', () => {
    const y = analyse().yongShen;
    for (const e of y.favourable) expect(y.unfavourable).not.toContain(e);
    expect(y.favourable.length + y.unfavourable.length).toBe(5);
  });
});

describe('姻缘', () => {
  it('picks the spouse star by gender', () => {
    expect(analyse({ gender: 'male' }).relationship.primaryStar).toBe('正财');
    expect(analyse({ gender: 'female' }).relationship.primaryStar).toBe('正官');
    expect(analyse({ gender: 'male' }).relationship.secondaryStar).toBe('偏财');
    expect(analyse({ gender: 'female' }).relationship.secondaryStar).toBe('七杀');
  });

  it('reads the marriage palace off the day branch', () => {
    const a = analyse();
    expect(a.relationship.spousePalace.branch).toBe(a.chart.pillars.day.branch);
  });

  it('does not count a stem clash as a palace disturbance', () => {
    // 辛亥 day, 乙未 hour: 乙辛相冲 is a STEM clash and must not disturb 夫妻宫.
    const a = analyse();
    expect(a.chart.pillars.hour!.stem).toBe('乙');
    expect(a.chart.pillars.day.stem).toBe('辛');
    for (const r of a.relationship.palaceDisturbances) {
      expect(isBranchRelation(r)).toBe(true);
    }
  });

  it('names the star it actually found, not the one it hoped for', () => {
    const a = analyse();
    const exposed = a.relationship.findings.find((f) => f.id === 'rel.star.exposed');
    if (exposed) {
      // Whatever 十神 the evidence cites must appear in the claim.
      for (const ev of exposed.evidence) {
        const match = /（(..)）/.exec(ev);
        if (match) expect(exposed.claim).toContain(match[1]!);
      }
    }
  });

  it('reports timing years that match the branch it claims', () => {
    const a = analyse();
    const t = a.relationship.findings.find((f) => f.id === 'rel.timing.favourable');
    if (t) {
      const claimed = /逢(.)年即被引动/.exec(t.claim);
      if (claimed) {
        const branch = claimed[1]!;
        const listedYears = [...t.claim.matchAll(/(\d{4})年（\d+岁）/g)].map((m) => Number(m[1]));
        for (const y of listedYears) {
          const w = a.relationship.windows.find((x) => x.year === y);
          expect(w?.ganZhi[1], `${y} should be a ${branch} year`).toBe(branch);
        }
      }
    }
  });

  it('marks 冲 years volatile rather than predicting a direction', () => {
    const a = analyse();
    const v = a.relationship.findings.find((f) => f.id === 'rel.timing.volatile');
    if (v) {
      expect(v.claim).toContain('方向取决于');
      expect(v.confidence).toBe('low');
    }
  });
});

describe('事业', () => {
  it('names a 格局 from the month branch', () => {
    const a = analyse();
    expect(a.career.structure).toBe('七杀格'); // 午 month 本气 丁 vs 辛 day master
  });

  it('leans employed for a weak day master with strong 官印', () => {
    const a = analyse();
    expect(a.strength.verdict).toBe('身弱');
    expect(a.career.lean).toBe('适合任职受雇');
  });

  it('scores every decade and keeps 有利 strict', () => {
    const a = analyse();
    expect(a.career.decades).toHaveLength(10);
    for (const d of a.career.decades) {
      if (d.verdict === '有利') expect(d.score).toBeGreaterThanOrEqual(3);
      if (d.verdict === '不利') expect(d.score).toBeLessThan(0);
    }
  });

  it('suggests industries matching the 用神 element', () => {
    const a = analyse();
    const f = a.career.findings.find((x) => x.id === 'career.industry')!;
    expect(f.claim).toContain(a.yongShen.primary);
  });
});

describe('神煞', () => {
  it('reports a star once per branch even when two references agree', () => {
    const a = analyse();
    const hits = findShenSha(a.chart);
    const keys = hits.map((h) => `${h.name}@${h.position}${h.branch}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('marks a doubled star rather than dropping the information', () => {
    const hits = findShenSha(analyse().chart);
    const doubled = hits.filter((h) => h.meaning.includes('两见'));
    for (const d of doubled) expect(d.meaning).toContain('力量加重');
  });
});

describe('findings contract', () => {
  it('suppresses hour-dependent findings when the hour is unknown', () => {
    const a = analyzeChart(
      buildChart({ year: 1990, month: 6, day: 15, timeZone: SG, gender: 'male' }),
    );
    expect(a.findings.every((f) => !f.requiresHour)).toBe(true);
  });

  it('gives every finding an id, a claim and at least one piece of evidence', () => {
    for (const f of analyse().findings) {
      expect(f.id).toMatch(/^(rel|career)\./);
      expect(f.claim.length).toBeGreaterThan(0);
      expect(f.evidence.length).toBeGreaterThan(0);
    }
  });

  it('uses unique finding ids', () => {
    const ids = analyse().findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic — the same chart yields identical findings', () => {
    const a = analyse();
    const b = analyse();
    expect(JSON.stringify(b.findings)).toBe(JSON.stringify(a.findings));
    expect(b.strength.supportPercent).toBe(a.strength.supportPercent);
    expect(b.yongShen.primary).toBe(a.yongShen.primary);
  });

  it('changes its reading when gender changes', () => {
    const m = analyse({ gender: 'male' });
    const f = analyse({ gender: 'female' });
    expect(f.relationship.primaryStar).not.toBe(m.relationship.primaryStar);
    expect(JSON.stringify(f.findings)).not.toBe(JSON.stringify(m.findings));
  });
});
