/**
 * 星盘 and 塔罗.
 *
 * The natal fixture is J2000 noon over Greenwich, the one instant every
 * ephemeris textbook prints: Sun at Capricorn 10°22′, Ascendant in Aries.
 */

import { describe, it, expect } from 'vitest';
import { computeNatal, SIGNS } from '../src/astro/natal';
import { readNatal } from '../src/astro/readings';
import { point, screenAngle, spreadAngles } from '../src/astro/wheel';
import { computeTransits, readDaily } from '../src/astro/transits';
import { computeSynastry, overlayText } from '../src/astro/synastry';
import { DECK, dailyCard, draw } from '../src/tarot/cards';

const J2000 = Date.UTC(2000, 0, 1, 12);

describe('星盘', () => {
  const c = computeNatal({ instantMs: J2000, lat: 51.5, lon: 0, timeKnown: true });
  const sun = c.planets.find((p) => p.key === 'Sun')!;

  it('puts the J2000 Sun at Capricorn 10.4°', () => {
    expect(sun.lon).toBeCloseTo(280.37, 1);
    expect(SIGNS[sun.sign]!.en).toBe('Capricorn');
    expect(sun.degree).toBeCloseTo(10.37, 1);
    expect(sun.retrograde).toBe(false);
  });

  it('rises Aries over Greenwich at J2000 noon, with the Sun on the Midheaven', () => {
    expect(Math.floor(c.ascendant! / 30)).toBe(0);
    expect(Math.abs(c.midheaven! - sun.lon)).toBeLessThan(2);
    expect(sun.house).toBe(10);
  });

  it('sees Saturn retrograde on 2000-01-01 and never the Sun', () => {
    expect(c.planets.find((p) => p.key === 'Saturn')!.retrograde).toBe(true);
    for (let m = 0; m < 12; m++) {
      const s = computeNatal({ instantMs: Date.UTC(2010, m, 15), lat: 1.35, lon: 103.82, timeKnown: true });
      expect(s.planets.find((p) => p.key === 'Sun')!.retrograde).toBe(false);
    }
  });

  it('finds the exact Sun–Saturn trine and keeps aspects within orb', () => {
    const trine = c.aspects.find((a) => a.a === 'Sun' && a.b === 'Saturn');
    expect(trine?.kind).toBe('trine');
    expect(trine!.orb).toBeLessThan(0.1);
    for (const a of c.aspects) expect(a.orb).toBeLessThanOrEqual(8);
  });

  it('drops the Ascendant and houses when the time is unknown', () => {
    const u = computeNatal({ instantMs: J2000, lat: 51.5, lon: 0, timeKnown: false });
    expect(u.ascendant).toBeNull();
    for (const p of u.planets) expect(p.house).toBeNull();
    const r = readNatal(u);
    expect(r.ascendant).toBeNull();
    expect(r.placements.every((p) => !/house|宫/.test(p.en + p.zh))).toBe(true);
  });

  it('reads the chart in both languages', () => {
    const r = readNatal(c);
    expect(r.sun.zh).toContain('摩羯');
    expect(r.sun.en).toContain('Capricorn');
    expect(r.ascendant!.en).toContain('Aries rising');
    expect(r.placements).toHaveLength(8);
    expect(r.placements.find((p) => p.en.startsWith('Saturn'))!.en).toContain('retrograde');
    expect(r.aspects[0]!.en).toContain('Sun trine');
  });
});

describe('塔罗', () => {
  it('is a full deck', () => {
    expect(DECK).toHaveLength(78);
    expect(DECK.filter((c) => c.arcana === 'major')).toHaveLength(22);
    expect(new Set(DECK.map((c) => c.name.en)).size).toBe(78);
    for (const c of DECK) for (const f of [c.name, c.upright, c.reversed]) {
      expect(f.zh.length).toBeGreaterThan(0);
      expect(f.en.length).toBeGreaterThan(0);
    }
  });

  it('draws distinct cards', () => {
    const d = draw(10);
    expect(new Set(d.map((x) => x.card.id)).size).toBe(10);
  });

  it('gives one person the same card all day and a different deck on another day', () => {
    const a = dailyCard('1990-06-15', '2026-09-18');
    expect(dailyCard('1990-06-15', '2026-09-18')).toEqual(a);
    const days = Array.from({ length: 30 }, (_, i) => dailyCard('1990-06-15', `2026-10-${String(i + 1).padStart(2, '0')}`).card.id);
    expect(new Set(days).size).toBeGreaterThan(15);
  });
});

describe('星盘 wheel geometry', () => {
  it('puts the rising sign at 9 o\'clock and runs the zodiac counter-clockwise', () => {
    // Scorpio rising: 0° Scorpio (210°) sits at the left, 0° Sagittarius 30° further down.
    expect(screenAngle(210, 210)).toBe(180);
    expect(screenAngle(240, 210)).toBe(210);
    const [x, y] = point(0, 0, 100, 210);
    expect(x).toBeLessThan(0); expect(y).toBeGreaterThan(0);
  });

  it('spreads a stellium apart without reordering it', () => {
    const out = spreadAngles([100, 102, 104, 250], 9);
    expect(out[3]).toBe(250);
    expect(out[1]! - out[0]!).toBeGreaterThanOrEqual(9 - 1e-3);
    expect(out[2]! - out[1]!).toBeGreaterThanOrEqual(9 - 1e-3);
    expect(out[0]! < out[1]! && out[1]! < out[2]!).toBe(true);
  });

  it('handles the wrap at 0°/360°', () => {
    const out = spreadAngles([358, 2], 9);
    const gap = ((out[1]! - out[0]!) % 360 + 360) % 360;
    expect(gap).toBeGreaterThanOrEqual(9 - 1e-3);
  });
});

describe('今日运势', () => {
  const natal = computeNatal({ instantMs: J2000, lat: 51.5, lon: 0, timeKnown: true });

  it('sees every planet conjunct itself when "today" is the birth instant', () => {
    const sky = computeTransits(natal, J2000);
    for (const k of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const) {
      const self = sky.transits.find((x) => x.t === k && x.n === k);
      expect(self?.kind).toBe('conjunction');
      expect(self!.orb).toBeLessThan(1e-6);
    }
    expect(sky.moonSign).toBe(natal.planets.find((p) => p.key === 'Moon')!.sign);
  });

  it('never reads outer-to-outer, and keeps orbs inside each planet\'s allowance', () => {
    const sky = computeTransits(natal, Date.UTC(2026, 8, 19));
    const outer = new Set(['Uranus', 'Neptune', 'Pluto']);
    for (const x of sky.transits) {
      expect(outer.has(x.t) && outer.has(x.n)).toBe(false);
      expect(x.tightness).toBeLessThanOrEqual(1);
    }
    expect(sky.transits.map((x) => x.tightness)).toEqual([...sky.transits.map((x) => x.tightness)].sort((a, b) => a - b));
  });

  it('gives three lenses a line each, in both languages, with 1–5 stars', () => {
    const r = readDaily(computeTransits(natal, Date.UTC(2026, 8, 19)));
    expect(r.lenses.map((l) => l.lens)).toEqual(['general', 'love', 'work']);
    for (const l of r.lenses) {
      expect(l.stars).toBeGreaterThanOrEqual(1); expect(l.stars).toBeLessThanOrEqual(5);
      expect(l.text.zh.length).toBeGreaterThan(5); expect(l.text.en.length).toBeGreaterThan(5);
    }
    const sources = r.lenses.map((l) => l.source?.en).filter(Boolean);
    expect(new Set(sources).size).toBe(sources.length); // no lens repeats another's headline
    expect(r.moon.zh).toMatch(/^月亮/); expect(r.moon.en).toMatch(/^Moon in/);
  });

  it('falls back to a quiet line when nothing is in orb', () => {
    const r = readDaily({ moonSign: 0, transits: [] });
    expect(r.lenses.every((l) => l.source === null && l.stars === 3)).toBe(true);
    expect(r.word).toBe('quiet');
  });

  it('gives a month of days a word each, and the Moon changes sign about every 2–3 days', () => {
    const words = new Set<string>(); let signChanges = 0; let last = -1;
    for (let i = 0; i < 30; i++) {
      const r = readDaily(computeTransits(natal, Date.UTC(2026, 8, 19, 4) + i * 86_400_000));
      words.add(r.word);
      if (r.moonSign !== last) { signChanges++; last = r.moonSign; }
    }
    expect(signChanges).toBeGreaterThanOrEqual(11); expect(signChanges).toBeLessThanOrEqual(15);
    expect(words.size).toBeGreaterThanOrEqual(2);
  });
});

describe('合盘', () => {
  const a = computeNatal({ instantMs: J2000, lat: 51.5, lon: 0, timeKnown: true });
  const b = computeNatal({ instantMs: Date.UTC(1992, 2, 2, 0, 10), lat: 1.35, lon: 103.82, timeKnown: true });

  it('reads a chart against itself as every planet conjunct its twin', () => {
    const s = computeSynastry(a, a);
    for (const k of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'] as const) {
      const twin = s.aspects.find((x) => x.a === k && x.b === k);
      expect(twin?.kind).toBe('conjunction');
      expect(twin!.orb).toBeLessThan(1e-6);
    }
    expect(s.overall).toBeGreaterThan(50);
  });

  it('is symmetric: swapping the two people mirrors the aspects and keeps the scores', () => {
    const ab = computeSynastry(a, b); const ba = computeSynastry(b, a);
    expect(ab.aspects.map((x) => `${x.b}-${x.a}-${x.kind}`).sort())
      .toEqual(ba.aspects.map((x) => `${x.a}-${x.b}-${x.kind}`).sort());
    expect(ab.factors.map((f) => f.score)).toEqual(ba.factors.map((f) => f.score));
    expect(ab.overall).toBe(ba.overall);
  });

  it('gives five factors, scored 0–100, with a line each in both languages', () => {
    const s = computeSynastry(a, b);
    expect(s.factors.map((f) => f.factor)).toEqual(['personality', 'communication', 'love', 'sexual', 'emotional']);
    for (const f of s.factors) {
      expect(f.score).toBeGreaterThanOrEqual(0); expect(f.score).toBeLessThanOrEqual(100);
      expect(f.text.zh.length).toBeGreaterThan(5); expect(f.text.en.length).toBeGreaterThan(5);
    }
    for (const x of s.aspects) expect(x.tightness).toBeLessThanOrEqual(1);
  });

  it('places the four personal planets in each other\'s houses, and none without a time', () => {
    const s = computeSynastry(a, b);
    expect(s.overlays.filter((o) => o.of === 'a')).toHaveLength(4);
    expect(s.overlays.filter((o) => o.of === 'b')).toHaveLength(4);
    for (const o of s.overlays) { expect(o.house).toBeGreaterThanOrEqual(1); expect(o.house).toBeLessThanOrEqual(12); }
    expect(overlayText(s.overlays[0]!).zh).toMatch(/落在.*第\d+宫/);
    const u = computeNatal({ instantMs: J2000, lat: 51.5, lon: 0, timeKnown: false });
    expect(computeSynastry(u, u).overlays).toHaveLength(0);
  });
});
