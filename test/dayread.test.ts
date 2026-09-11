/**
 * The relationship-lens day reader.
 *
 * Two properties carry these tests. First, colour never scores: the ten god,
 * the stars and the form may say what a day is like, but only a relation to
 * the 夫妻宫 or a mirror day can make it register — otherwise the band
 * distribution drifts and "most days quiet" stops being true. Second, a day
 * that registers must say WHAT it does, and the kind of relation must decide
 * that: a 六冲 day is friction, a 六合 day is close, never the reverse.
 */

import { describe, it, expect } from 'vitest';
import { buildChart, transitPillars } from '../src/engine/chart';
import { readPersonDay, MODE_LABEL, type Favour, type PersonDay } from '../src/analyzer/topics/dayread';
import { favourOf, forecastRelationship } from '../src/analyzer/topics/forecast';
import { forecastJoint } from '../src/analyzer/topics/joint';
import { LOCALES } from '../src/i18n/text';
import type { BirthInput, Chart } from '../src/engine/types';

const SG = 'Asia/Singapore';
const birth = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 30,
  timeZone: SG, gender: 'male', useTrueSolarTime: false, ...o,
});
const CHINESE_PROSE = /[的是不有在了会要为与和之则者宜主多易]/;

const male = buildChart(birth());
const female = buildChart(birth({ year: 1992, month: 11, day: 3, hour: 9, gender: 'female' }));

/** Sixty consecutive days — one full 干支 cycle, so every day pillar occurs once. */
function cycle(chart: Chart, favour: Favour = favourOf(chart)): PersonDay[] {
  const out: PersonDay[] = [];
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 60; i++) {
    const d = new Date(start + i * 86_400_000);
    const p = transitPillars(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()).day;
    out.push(readPersonDay(chart, favour, {
      stem: p.getHeavenStem().getName(), branch: p.getEarthBranch().getName(),
    }));
  }
  return out;
}

const STRUCTURAL = /夫妻宫|伏吟|天克地冲/;

describe('day reader — what registers', () => {
  it('only a relation to the palace or a mirror day can lift a day out of quiet', () => {
    for (const chart of [male, female]) {
      for (const day of cycle(chart)) {
        const structural = day.notes.some((n) => STRUCTURAL.test(n.zh));
        if (!structural) expect(day.band, day.notes.map((n) => n.zh).join(' | ')).toBe('quiet');
        if (day.band !== 'quiet') expect(structural).toBe(true);
      }
    }
  });

  it('keeps most days quiet across a full cycle', () => {
    for (const chart of [male, female]) {
      const quiet = cycle(chart).filter((d) => d.band === 'quiet').length;
      expect(quiet).toBeGreaterThan(30);
    }
  });

  it('names the day even when it is quiet — a ten god every day, a form on most', () => {
    const days = cycle(male);
    for (const d of days) expect(d.notes.length).toBeGreaterThan(0);
    expect(days.filter((d) => d.form !== null).length).toBeGreaterThan(20);
  });

  it('gives a mode to every day that registers and none to a quiet one', () => {
    for (const d of cycle(male)) {
      if (d.band === 'quiet') expect(d.mode).toBe('quiet');
      else expect(['close', 'stirred', 'friction', 'apart']).toContain(d.mode);
    }
  });
});

describe('day reader — what it says', () => {
  const branchOf = (d: PersonDay) => d.notes.map((n) => n.zh).join(' ');

  it('reads a 六合 day as close and a 六冲 day as friction', () => {
    const days = cycle(male);
    const close = days.filter((d) => /六合夫妻宫/.test(branchOf(d)));
    const clash = days.filter((d) => /冲夫妻宫/.test(branchOf(d)));
    expect(close.length).toBeGreaterThan(0);
    expect(clash.length).toBeGreaterThan(0);
    for (const d of close) expect(d.mode).toBe('close');
    for (const d of clash) expect(d.mode).toBe('friction');
  });

  it('flags the one day in sixty that repeats the Day Pillar as 伏吟, and it registers', () => {
    const days = cycle(male);
    const mirror = days.filter((d) => /伏吟/.test(branchOf(d)));
    expect(mirror).toHaveLength(1);
    expect(mirror[0]!.band).not.toBe('quiet');
    expect(mirror[0]!.mode).toBe('apart');
  });

  it('flags 天克地冲 only on a clash day whose stem also strikes the day master, and makes it notable', () => {
    const days = cycle(male);
    const heavy = days.filter((d) => /天克地冲/.test(branchOf(d)));
    expect(heavy.length).toBeGreaterThan(0);
    for (const d of heavy) {
      expect(/冲夫妻宫/.test(branchOf(d))).toBe(true);
      expect(d.band).toBe('notable');
    }
  });

  it('names the spouse star for the right gender', () => {
    const m = cycle(male).map(branchOf).join(' ');
    const f = cycle(female).map(branchOf).join(' ');
    expect(m).toContain('正财，配偶星');
    expect(m).not.toContain('正官，配偶星');
    expect(f).toContain('正官，配偶星');
    expect(f).not.toContain('正财，配偶星');
  });

  it('lets a woman’s 伤官 day vote friction and a man’s 比劫 day vote apart', () => {
    // Colour cannot lift a day, so look at days that registered anyway and
    // check the vote went where it should when nothing heavier outweighed it.
    const f = cycle(female).find((d) => /伤官见官/.test(branchOf(d)) && /半合|害|破/.test(branchOf(d)) && !/六合|三合|冲/.test(branchOf(d)));
    if (f && f.band !== 'quiet') expect(f.mode).toBe('friction');
    const m = cycle(male).find((d) => /比劫争财/.test(branchOf(d)) && d.band !== 'quiet' && !/六合|三合|冲|刑/.test(branchOf(d)));
    if (m) expect(['apart', 'friction']).toContain(m.mode);
  });

  it('reads form from the favourable elements, and never scores it', () => {
    const fav: Favour = { favourable: ['木', '火'], unfavourable: ['金', '水'] };
    const flipped: Favour = { favourable: ['金', '水'], unfavourable: ['木', '火'] };
    const a = cycle(male, fav);
    const b = cycle(male, flipped);
    let differ = 0;
    for (let i = 0; i < 60; i++) {
      expect(b[i]!.score).toBe(a[i]!.score);
      expect(b[i]!.band).toBe(a[i]!.band);
      if (a[i]!.form !== b[i]!.form) differ++;
    }
    expect(differ).toBeGreaterThan(20);
  });

  it('writes every note in both languages without leaking Chinese prose', () => {
    for (const d of cycle(female)) {
      for (const n of d.notes) {
        expect(n.zh.length).toBeGreaterThan(0);
        expect(n.en.length).toBeGreaterThan(0);
        expect(CHINESE_PROSE.test(n.en), `leaked: ${n.en}`).toBe(false);
      }
    }
    for (const m of Object.values(MODE_LABEL)) {
      for (const l of LOCALES) expect(m[l].length).toBeGreaterThan(0);
    }
  });
});

describe('forecast surfaces carry the mode', () => {
  const from = new Date(Date.UTC(2026, 2, 1));

  it('solo: the headline names the standout day by its mode, not good or bad', () => {
    const f = forecastRelationship(male, from, 30);
    expect(f.standout).not.toBeNull();
    expect(f.headline.en).toContain(MODE_LABEL[f.standout!.mode].en);
    expect(f.headline.en).not.toMatch(/\b(lucky|good day|bad day)\b/);
    for (const d of f.days) {
      expect(d.mode).toBeDefined();
      expect(d.form === null || d.form === 'steady' || d.form === 'low').toBe(true);
    }
  });

  it('joint: a day that touches only one side never registers between you', () => {
    const f = forecastJoint(male, female, from, 60);
    for (const d of f.days) {
      const oneSided = d.between.notes.some((n) => /只动/.test(n.zh));
      if (oneSided) expect(d.between.band).toBe('quiet');
    }
  });

  it('joint: "one current" fires only when a 三合/三会 spans both day branches', () => {
    // 1990-06-15 is a 辛亥 day; 1992-11-03 a 癸未 day: 亥 and 未 need 卯 for 三合木.
    expect(male.pillars.day.branch).toBe('亥');
    expect(female.pillars.day.branch).toBe('未');
    const f = forecastJoint(male, female, from, 60);
    const current = f.days.filter((d) => d.between.notes.some((n) => /同一股气/.test(n.zh)));
    expect(current.length).toBeGreaterThan(0);
    for (const d of current) {
      expect(d.ganZhi.endsWith('卯')).toBe(true);
      expect(d.between.mode).toBe('close');
    }
    // 戊申 day: 申 shares no 三合 or 三会 group with 亥, so it never fires.
    const other = buildChart(birth({ year: 1991, month: 4, day: 8, gender: 'female' }));
    expect(other.pillars.day.branch).toBe('申');
    const g = forecastJoint(male, other, from, 60);
    expect(g.days.some((d) => d.between.notes.some((n) => /同一股气/.test(n.zh)))).toBe(false);
  });

  it('joint: 通关 fires only for day masters that control each other', () => {
    // 辛 (金) with 乙 (木): 金克木, 水 mediates — 壬 and 癸 days.
    const wood = buildChart(birth({ year: 1988, month: 2, day: 20, gender: 'female' }));
    expect(male.dayMasterElement).toBe('金');
    expect(wood.dayMasterElement).toBe('木');
    const f = forecastJoint(male, wood, from, 60);
    const mediated = f.days.filter((d) => d.between.notes.some((n) => /通关/.test(n.zh)));
    expect(mediated.length).toBeGreaterThan(0);
    for (const d of mediated) expect(['壬', '癸']).toContain(d.ganZhi[0]);

    // 辛 (金) with 癸 (水): 金生水, nothing to mediate.
    expect(female.dayMasterElement).toBe('水');
    const g = forecastJoint(male, female, from, 60);
    expect(g.days.some((d) => d.between.notes.some((n) => /通关/.test(n.zh)))).toBe(false);
  });
});
