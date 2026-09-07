/**
 * The 神煞 added in the 天乙贵人 batch.
 *
 * Each star is a lookup table, so the risks are a transcription error in the
 * table and a wiring error in how it is emitted. The tests guard both: the
 * canonical mappings are restated here as the source of truth and every hit the
 * engine produces must match them, and a sweep proves each new star is actually
 * reachable (a table nothing ever hits is untested regardless of how right it
 * looks). 羊刃 gets a real negative control — it must never touch a 阴干 chart.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { findShenSha } from '../src/analyzer/shensha';
import { SHENSHA } from '../src/i18n/glossary';
import type { BirthInput } from '../src/engine/types';

const at = (o: Partial<BirthInput>): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 0,
  timeZone: 'Asia/Shanghai', longitude: 121.47, gender: 'male',
  useTrueSolarTime: false, ...o,
});

// Canonical tables, restated independently of the source.
const NOBLE: Record<string, string[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['午', '寅'],
};
const WEN_CHANG: Record<string, string> = {
  甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
};
const PROSPERITY: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};
const GOLDEN: Record<string, string> = {
  甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅',
};
const BLADE: Record<string, string> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
const KUI_GANG = new Set(['庚辰', '庚戌', '壬辰', '戊戌']);
const NEW_STARS = ['天乙贵人', '文昌', '禄神', '金舆', '羊刃', '华盖', '魁罡'];

// A wide, deterministic sweep of charts.
const CHARTS = (() => {
  const out = [];
  for (let year = 1948; year <= 2012; year += 2) {
    for (const month of [1, 4, 7, 10]) {
      for (const day of [5, 15, 25]) {
        for (const hour of [2, 10, 20]) {
          out.push(buildChart(at({ year, month, day, hour })));
        }
      }
    }
  }
  return out;
})();

const branchesOf = (c: ReturnType<typeof buildChart>) =>
  [c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour]
    .filter((p) => p !== null)
    .map((p) => p!.branch);

describe('新增神煞 tables and wiring', () => {
  it('every new star is reachable in the sweep', () => {
    const seen = new Set<string>();
    for (const c of CHARTS) for (const h of findShenSha(c)) seen.add(h.name);
    for (const name of NEW_STARS) {
      expect(seen.has(name), `${name} never fires`).toBe(true);
    }
  });

  it('every emitted star name has a bilingual glossary entry', () => {
    for (const c of CHARTS) {
      for (const h of findShenSha(c)) {
        expect(SHENSHA[h.name], `${h.name} missing from SHENSHA`).toBeDefined();
        expect(SHENSHA[h.name]!.en).not.toBe(SHENSHA[h.name]!.zh);
      }
    }
  });

  it('天乙贵人 only lands on a table branch for the day stem', () => {
    for (const c of CHARTS) {
      const dm = c.dayMaster;
      const branches = branchesOf(c);
      for (const h of findShenSha(c).filter((x) => x.name === '天乙贵人')) {
        expect(NOBLE[dm]).toContain(h.branch);
        expect(branches).toContain(h.branch);
      }
    }
  });

  it('文昌 / 禄神 / 金舆 sit on exactly their day-stem branch', () => {
    const tables = { 文昌: WEN_CHANG, 禄神: PROSPERITY, 金舆: GOLDEN } as const;
    for (const c of CHARTS) {
      const dm = c.dayMaster;
      for (const h of findShenSha(c)) {
        if (h.name in tables) {
          expect(h.branch).toBe(tables[h.name as keyof typeof tables][dm]);
        }
      }
    }
  });

  it('羊刃 fires only for 阳干 day masters (阴干无刃), on the 帝旺 branch', () => {
    let yang = 0;
    for (const c of CHARTS) {
      for (const h of findShenSha(c).filter((x) => x.name === '羊刃')) {
        expect(c.dayMasterYinYang).toBe('阳');
        expect(h.branch).toBe(BLADE[c.dayMaster]);
        yang++;
      }
    }
    expect(yang, '羊刃 never fired — negative control proves nothing').toBeGreaterThan(0);
  });

  it('魁罡 fires only on the four 魁罡 day pillars', () => {
    let hits = 0;
    for (const c of CHARTS) {
      const has = findShenSha(c).some((x) => x.name === '魁罡');
      expect(has).toBe(KUI_GANG.has(c.pillars.day.ganZhi));
      if (has) hits++;
    }
    expect(hits).toBeGreaterThan(0);
  });
});
