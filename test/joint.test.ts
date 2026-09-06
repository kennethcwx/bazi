/**
 * The joint forecast and the 时辰 breakdown.
 *
 * Two properties carry these tests. First, the three tracks must be computed
 * separately — a day that is easy for one person and abrasive for the other has
 * to say so, which is the whole reason the feature exists. Second, the hour
 * breakdown must stay quiet most of the time: 时辰 is the lightest layer in the
 * system, and a table where half the day glows is measuring nothing.
 */

import { describe, it, expect } from 'vitest';
import { buildChart } from '../src/engine/chart';
import { forecastJoint, hourBreakdown, JOINT_CAVEAT } from '../src/analyzer/topics/joint';
import { LOCALES } from '../src/i18n/text';
import type { BirthInput } from '../src/engine/types';

const SG = 'Asia/Singapore';
const birth = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 30,
  timeZone: SG, gender: 'male', useTrueSolarTime: false, ...o,
});

const self = buildChart(birth());
const partner = buildChart(birth({ year: 1992, month: 11, day: 3, hour: 9, gender: 'female' }));
const from = new Date(Date.UTC(2026, 2, 1));
const CHINESE_PROSE = /[的是不有在了会要为与和之则者宜主多易]/;

describe('joint forecast', () => {
  it('reads each day three separate ways', () => {
    for (const d of forecastJoint(self, partner, from, 14).days) {
      for (const k of ['yours', 'theirs', 'between'] as const) {
        expect(['notable', 'mild', 'quiet']).toContain(d[k].band);
      }
    }
  });

  it('never averages the two people into one verdict', () => {
    // Across a month there must be at least one day the two sides read
    // differently, or the split is decorative.
    const days = forecastJoint(self, partner, from, 30).days;
    const split = days.filter((d) => d.yours.band !== d.theirs.band);
    expect(split.length, 'expected the two sides to diverge somewhere').toBeGreaterThan(0);
  });

  it('scores your side the same whether or not a partner is present', () => {
    // Adding a partner must not quietly change your own reading.
    const withPartner = forecastJoint(self, partner, from, 14);
    const swapped = forecastJoint(self, buildChart(birth({ year: 1985, month: 2, day: 2 })), from, 14);
    for (let i = 0; i < 14; i++) {
      expect(swapped.days[i]!.yours.score, swapped.days[i]!.date)
        .toBe(withPartner.days[i]!.yours.score);
    }
  });

  it('is symmetric: swapping the pair swaps the sides', () => {
    const a = forecastJoint(self, partner, from, 10);
    const b = forecastJoint(partner, self, from, 10);
    for (let i = 0; i < 10; i++) {
      expect(b.days[i]!.yours.score).toBe(a.days[i]!.theirs.score);
      expect(b.days[i]!.theirs.score).toBe(a.days[i]!.yours.score);
    }
  });

  it('leaves most days quiet between the two of you', () => {
    const days = forecastJoint(self, partner, from, 30).days;
    const quiet = days.filter((d) => d.between.band === 'quiet').length;
    expect(quiet).toBeGreaterThan(days.length / 2);
  });

  it('says plainly when no day engages both', () => {
    const f = forecastJoint(self, partner, from, 2);
    if (f.days.every((d) => d.between.score < 3)) {
      expect(f.headline.zh).toContain('没有同时');
      expect(f.headline.en).toContain('No day');
    }
  });

  it('is deterministic', () => {
    const a = forecastJoint(self, partner, from, 14);
    const b = forecastJoint(self, partner, from, 14);
    expect(JSON.stringify(b.days)).toBe(JSON.stringify(a.days));
  });

  it('writes both languages, with no leakage', () => {
    const f = forecastJoint(self, partner, from, 30);
    for (const l of LOCALES) expect(f.headline[l].length).toBeGreaterThan(10);
    expect(CHINESE_PROSE.test(f.headline.en)).toBe(false);
    for (const d of f.days) {
      for (const side of [d.yours, d.theirs, d.between]) {
        for (const n of side.notes) {
          expect(n.zh.length).toBeGreaterThan(0);
          expect(CHINESE_PROSE.test(n.en), `leaked: ${n.en}`).toBe(false);
        }
      }
    }
  });

  it('carries a caveat that refuses to call these auspicious hours', () => {
    expect(JOINT_CAVEAT.zh).toContain('不是吉时');
    expect(JOINT_CAVEAT.en).toContain('not an auspicious hour');
    expect(CHINESE_PROSE.test(JOINT_CAVEAT.en)).toBe(false);
  });
});

describe('时辰 breakdown', () => {
  const hours = hourBreakdown('2026-03-05', self, partner, ['土', '金']);

  it('covers all twelve, in order, each with its own 干支', () => {
    expect(hours).toHaveLength(12);
    expect(hours.map((h) => h.branch).join('')).toBe('子丑寅卯辰巳午未申酉戌亥');
    expect(new Set(hours.map((h) => h.ganZhi)).size).toBe(12);
  });

  it('labels the standard two-hour ranges', () => {
    expect(hours[0]!.range).toBe('23:00–01:00');
    expect(hours[6]!.range).toBe('11:00–13:00');
  });

  it('reports each side separately rather than as one number', () => {
    for (const h of hours) {
      expect([null, 'harmony', 'clash']).toContain(h.forYou);
      expect([null, 'harmony', 'clash']).toContain(h.forThem);
    }
    // A clash on either side rules the hour out; harmony with neither side
    // clashing makes it good.
    for (const h of hours) {
      const clashes = h.forYou === 'clash' || h.forThem === 'clash';
      const harmonises = h.forYou === 'harmony' || h.forThem === 'harmony';
      expect(h.band).toBe(clashes ? 'avoid' : harmonises ? 'good' : 'neutral');
    }
  });

  it('can actually reach every band — an unreachable one is decoration', () => {
    // The first attempt summed relations against a threshold, which made
    // 'good' unreachable: an hour can only 六合 one branch, so harmonising both
    // people AND carrying a favourable element never happened. Zero good hours
    // in 720. This asserts the bands are all live.
    const seen = new Set<string>();
    for (let d = 1; d <= 60; d++) {
      const iso = new Date(Date.UTC(2026, 2, d)).toISOString().slice(0, 10);
      for (const h of hourBreakdown(iso, self, partner, ['土', '金'])) seen.add(h.band);
    }
    expect([...seen].sort()).toEqual(['avoid', 'good', 'neutral']);
  });

  it('still leaves the plain hours in the majority', () => {
    let neutral = 0, total = 0;
    for (let d = 1; d <= 30; d++) {
      const iso = new Date(Date.UTC(2026, 2, d)).toISOString().slice(0, 10);
      for (const h of hourBreakdown(iso, self, partner, ['土', '金'])) {
        total++;
        if (h.band === 'neutral') neutral++;
      }
    }
    expect(neutral / total).toBeGreaterThan(0.45);
  });

  it('gives every non-neutral hour a reason', () => {
    for (const h of hours) {
      if (h.band !== 'neutral') expect(h.notes.length, h.branch).toBeGreaterThan(0);
    }
  });

  it('works with no partner at all', () => {
    const solo = hourBreakdown('2026-03-05', self, null, []);
    expect(solo).toHaveLength(12);
    expect(solo.every((h) => ['good', 'neutral', 'avoid'].includes(h.band))).toBe(true);
  });

  it('changes when the partner changes', () => {
    const other = buildChart(birth({ year: 1985, month: 2, day: 2, hour: 6 }));
    const a = hourBreakdown('2026-03-05', self, partner, []);
    const b = hourBreakdown('2026-03-05', self, other, []);
    expect(a.map((h) => h.band + h.forThem).join()).not.toBe(b.map((h) => h.band + h.forThem).join());
  });

  it('is deterministic and bilingual', () => {
    expect(JSON.stringify(hourBreakdown('2026-03-05', self, partner, ['土', '金'])))
      .toBe(JSON.stringify(hours));
    for (const h of hours) {
      for (const n of h.notes) expect(CHINESE_PROSE.test(n.en), `leaked: ${n.en}`).toBe(false);
    }
  });
});
