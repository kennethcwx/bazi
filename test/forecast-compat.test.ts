/**
 * 流日 forecast and 合婚.
 *
 * The forecast tests lean on one property above all: **most days must be
 * quiet.** A day-level forecast that finds something every day is measuring
 * noise, and that failure is invisible without a test that counts.
 *
 * The compatibility tests lean on asymmetry: the two directions must be
 * computed independently, because collapsing them is the dishonest move this
 * feature exists to avoid.
 */

import { describe, it, expect } from 'vitest';
import { buildChart, transitPillars } from '../src/engine/chart';
import { analyzeStrength } from '../src/analyzer/strength';
import { analyzeYongShen } from '../src/analyzer/yongshen';
import { forecastRelationship, FORECAST_CAVEAT } from '../src/analyzer/topics/forecast';
import { analyzeCompatibility, type Side } from '../src/analyzer/topics/compatibility';
import { analyzeChart } from '../src/analyzer/index';
import { LOCALES } from '../src/i18n/text';
import type { BirthInput } from '../src/engine/types';

const SG = 'Asia/Singapore';
const birth = (o: Partial<BirthInput> = {}): BirthInput => ({
  year: 1990, month: 6, day: 15, hour: 14, minute: 30,
  timeZone: SG, gender: 'male', useTrueSolarTime: false, ...o,
});

function side(o: Partial<BirthInput> = {}): Side {
  const chart = buildChart(birth(o));
  const strength = analyzeStrength(chart);
  return { chart, strength, yongShen: analyzeYongShen(chart, strength) };
}

const CHINESE_PROSE = /[的是不有在了会要为与和之则者宜主多易]/;

describe('transit pillars', () => {
  it('advances the day pillar by one sexagenary step per calendar day', () => {
    const a = transitPillars(2026, 3, 10).day.getName();
    const b = transitPillars(2026, 3, 11).day.getName();
    const STEMS = '甲乙丙丁戊己庚辛壬癸';
    const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
    const idx = (gz: string) => {
      const s = STEMS.indexOf(gz[0]!);
      const br = BRANCHES.indexOf(gz[1]!);
      const k = ((((br - s) / 2) * 5) % 6 + 6) % 6;
      return s + 10 * k;
    };
    expect(idx(b)).toBe((idx(a) + 1) % 60);
  });

  it('charts at noon so a 23:00 boundary does not shift the day', () => {
    // The transit for a date must equal the day pillar of that date at midday,
    // not the next day's — which is what a 23:00 reading would give.
    const t = transitPillars(2026, 3, 10).day.getName();
    const noon = buildChart(birth({ year: 2026, month: 3, day: 10, hour: 12, minute: 0 }));
    expect(t).toBe(noon.pillars.day.ganZhi);
  });
});

describe('relationship forecast', () => {
  const chart = buildChart(birth());
  const from = new Date(Date.UTC(2026, 2, 1));

  it('returns exactly the requested number of days', () => {
    for (const n of [1, 7, 14, 30]) {
      expect(forecastRelationship(chart, from, n).days).toHaveLength(n);
    }
  });

  it('caps the window rather than producing an unbounded list', () => {
    expect(forecastRelationship(chart, from, 400).days.length).toBeLessThanOrEqual(31);
    expect(forecastRelationship(chart, from, 0).days).toHaveLength(1);
  });

  it('leaves most days quiet — a forecast that fires daily measures nothing', () => {
    const f = forecastRelationship(chart, from, 30);
    const quiet = f.days.filter((d) => d.band === 'quiet').length;
    expect(quiet, 'expected the majority of days to carry no signal')
      .toBeGreaterThan(f.days.length / 2);
  });

  it('gives every non-quiet day at least one concrete note', () => {
    const f = forecastRelationship(chart, from, 30);
    for (const d of f.days) {
      if (d.band !== 'quiet') expect(d.notes.length, d.date).toBeGreaterThan(0);
      else expect(d.score).toBeLessThan(2);
    }
  });

  it('grades days as notable/mild/quiet, never as good or bad', () => {
    const f = forecastRelationship(chart, from, 14);
    for (const d of f.days) expect(['notable', 'mild', 'quiet']).toContain(d.band);
  });

  it('says so plainly when nothing is in play', () => {
    // A window with no notable day must produce the honest headline rather
    // than reaching for something to report.
    let found = false;
    for (let month = 1; month <= 12 && !found; month++) {
      const f = forecastRelationship(chart, new Date(Date.UTC(2026, month - 1, 1)), 3);
      if (!f.standout) {
        found = true;
        expect(f.headline.zh).toContain('没有明显');
        expect(f.headline.en).toContain('Nothing in these');
      }
    }
    expect(found, 'expected at least one quiet 3-day window in a year').toBe(true);
  });

  it('is deterministic for the same chart and window', () => {
    const a = forecastRelationship(chart, from, 14);
    const b = forecastRelationship(chart, from, 14);
    expect(JSON.stringify(b.days)).toBe(JSON.stringify(a.days));
  });

  it('carries the caveat in both languages, without leaking either', () => {
    for (const l of LOCALES) expect(FORECAST_CAVEAT[l].length).toBeGreaterThan(40);
    expect(CHINESE_PROSE.test(FORECAST_CAVEAT.en)).toBe(false);
    expect(FORECAST_CAVEAT.en).toContain('lightest layer');
    expect(FORECAST_CAVEAT.zh).toContain('最轻的一层');
  });

  it('writes every note and headline in both languages', () => {
    const f = forecastRelationship(chart, from, 30);
    for (const l of LOCALES) expect(f.headline[l].length).toBeGreaterThan(10);
    expect(CHINESE_PROSE.test(f.headline.en)).toBe(false);
    for (const d of f.days) {
      for (const n of d.notes) {
        expect(n.zh.length).toBeGreaterThan(0);
        expect(n.en.length).toBeGreaterThan(0);
        expect(CHINESE_PROSE.test(n.en), `leaked: ${n.en}`).toBe(false);
      }
    }
  });

  it('reports the ISO range it actually covered', () => {
    const f = forecastRelationship(chart, from, 7);
    expect(f.from).toBe('2026-03-01');
    expect(f.to).toBe('2026-03-07');
  });
});

describe('合婚 stays out of the single-chart reading', () => {
  // 合婚 findings are tagged topic:'relationship' so they render in the same UI,
  // but they describe two charts. If they ever leaked into analyzeChart the
  // narrator would cite them while its prompt held only one chart — a claim
  // about a partner the model was never shown. Nothing merges them today; this
  // is here so nothing starts to.
  it('never appears in the findings analyzeChart produces', () => {
    for (const gender of ['male', 'female'] as const) {
      for (const month of [1, 4, 7, 10]) {
        const a = analyzeChart(buildChart(birth({ month, gender })));
        const leaked = a.findings.filter((f) => f.id.startsWith('compat.'));
        expect(leaked.map((f) => f.id), `${gender} month ${month}`).toEqual([]);
      }
    }
  });

  it('only produces compat.* ids, so the two sets never collide', () => {
    const c = analyzeCompatibility(
      side({ gender: 'male' }),
      side({ year: 1992, month: 11, day: 3, hour: 9, gender: 'female' }),
    );
    for (const f of c.findings) expect(f.id.startsWith('compat.'), f.id).toBe(true);
  });
});

describe('合婚 compatibility', () => {
  const a = side({ year: 1990, month: 6, day: 15, gender: 'male' });
  const b = side({ year: 1992, month: 11, day: 3, hour: 9, gender: 'female' });

  it('computes the two supply directions independently', () => {
    const c = analyzeCompatibility(a, b);
    const reversed = analyzeCompatibility(b, a);
    // Swapping the sides must swap the figures, not repeat them.
    expect(reversed.supplyToA).toBe(c.supplyToB);
    expect(reversed.supplyToB).toBe(c.supplyToA);
  });

  it('reports supply as a percentage of the partner chart', () => {
    const c = analyzeCompatibility(a, b);
    for (const v of [c.supplyToA, c.supplyToB]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('never reduces the pair to a single match score', () => {
    const c = analyzeCompatibility(a, b);
    const text = JSON.stringify(c.findings);
    expect(text).not.toMatch(/匹配度|match score|compatibility score/i);
    // Both directions must appear in the supply finding.
    const supplyFinding = c.findings.find((f) => f.id === 'compat.supply')!;
    expect(supplyFinding.claim.zh).toContain(String(c.supplyToA));
    expect(supplyFinding.claim.zh).toContain(String(c.supplyToB));
  });

  it('always produces a day-pillar reading, harmonious, clashing or neutral', () => {
    const ids = analyzeCompatibility(a, b).findings.map((f) => f.id);
    expect(ids.some((id) => id.startsWith('compat.day.'))).toBe(true);
  });

  it('weights 生肖 as low confidence and says why', () => {
    // Sweep for a pair whose year branches actually relate.
    let zodiac;
    for (let y = 1985; y <= 2000 && !zodiac; y++) {
      const other = side({ year: y, month: 5, day: 5, gender: 'female' });
      zodiac = analyzeCompatibility(a, other).findings.find((f) => f.id === 'compat.zodiac');
    }
    expect(zodiac, 'expected a zodiac relation in the sweep').toBeDefined();
    expect(zodiac!.confidence).toBe('low');
    expect(zodiac!.salience).toBeLessThan(5);
    expect(zodiac!.claim.zh).toContain('十二类');
    expect(zodiac!.claim.en).toContain('twelve boxes');
  });

  it('flags a missing hour on either side', () => {
    const noHour = side({ year: 1992, month: 11, day: 3, gender: 'female' });
    delete (noHour.chart as { hour?: unknown }).hour;
    const c = analyzeCompatibility(a, {
      ...noHour,
      chart: { ...noHour.chart, hourKnown: false },
    });
    expect(c.findings.some((f) => f.id === 'compat.no-hour')).toBe(true);
  });

  it('writes every finding in both languages', () => {
    for (const f of analyzeCompatibility(a, b).findings) {
      expect(f.claim.zh.length).toBeGreaterThan(0);
      expect(f.claim.en.length).toBeGreaterThan(0);
      expect(f.claim.zh).not.toBe(f.claim.en);
      expect(CHINESE_PROSE.test(f.claim.en), `leaked: ${f.claim.en}`).toBe(false);
      for (const e of f.evidence) {
        expect(CHINESE_PROSE.test(e.en), `leaked: ${e.en}`).toBe(false);
      }
    }
  });

  it('is deterministic', () => {
    const x = analyzeCompatibility(a, b);
    const y = analyzeCompatibility(a, b);
    expect(JSON.stringify(y.findings)).toBe(JSON.stringify(x.findings));
  });

  it('names the 用神 school in its evidence, as the single-chart readings do', () => {
    const c = analyzeCompatibility(a, b);
    const supply = c.findings.find((f) => f.id === 'compat.supply')!;
    expect(supply.evidence.some((e) => e.zh.includes('流派'))).toBe(true);
    expect(supply.evidence.some((e) => e.en.includes('Method used'))).toBe(true);
  });
});
