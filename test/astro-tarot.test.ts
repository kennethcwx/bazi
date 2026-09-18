/**
 * 星盘 and 塔罗.
 *
 * The natal fixture is J2000 noon over Greenwich, the one instant every
 * ephemeris textbook prints: Sun at Capricorn 10°22′, Ascendant in Aries.
 */

import { describe, it, expect } from 'vitest';
import { computeNatal, SIGNS } from '../src/astro/natal';
import { readNatal } from '../src/astro/readings';
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
