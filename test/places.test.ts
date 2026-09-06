/**
 * The birthplace table.
 *
 * Around 130 rows entered by hand, each with an IANA zone and a longitude. A
 * typo'd zone ("Asia/Toyko") or a city paired with the wrong country produces
 * a chart that is silently and confidently wrong, which is the worst failure
 * mode this app has. These tests make both loud.
 */

import { describe, it, expect } from 'vitest';
import { PLACES, DEFAULT_PLACE, searchPlaces } from '../src/places';
import { buildChart } from '../src/engine/chart';
import { trueSolarCorrectionMinutes } from '../src/engine/moment';

/** Resolve a zone the way the engine does; throws on an unknown zone. */
function offsetMinutes(tz: string, instant: number): number {
  const raw = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(new Date(instant))
    .find((p) => p.type === 'timeZoneName')!.value;
  const m = /^GMT([+-])(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) *
    (Number(m[2]) * 60 + Number(m[3]) + Number(m[4] ?? 0) / 60);
}

describe('place table integrity', () => {
  it('has a useful number of places', () => {
    expect(PLACES.length).toBeGreaterThan(100);
  });

  it('names every place in both languages', () => {
    for (const p of PLACES) {
      expect(p.zh.trim().length, p.en).toBeGreaterThan(0);
      expect(p.en.trim().length, p.zh).toBeGreaterThan(0);
      expect(p.region.zh.length).toBeGreaterThan(0);
      expect(p.region.en.length).toBeGreaterThan(0);
    }
  });

  it('uses only time zones the platform actually knows', () => {
    for (const p of PLACES) {
      expect(
        () => new Intl.DateTimeFormat('en-US', { timeZone: p.tz }).format(new Date()),
        `${p.en}: unknown time zone "${p.tz}"`,
      ).not.toThrow();
    }
  });

  it('keeps every longitude on the planet', () => {
    for (const p of PLACES) {
      expect(p.lon, p.en).toBeGreaterThanOrEqual(-180);
      expect(p.lon, p.en).toBeLessThanOrEqual(180);
    }
  });

  it('pairs each longitude with a plausible time zone', () => {
    // A city matched to the wrong zone shows up as an absurd true-solar
    // correction. China deliberately runs one clock across 60 degrees, so the
    // bound is generous — but a Tokyo/New_York mix-up is hours out, not minutes.
    const instant = Date.UTC(2000, 5, 15, 12);
    for (const p of PLACES) {
      const correction = trueSolarCorrectionMinutes(instant, p.lon, offsetMinutes(p.tz, instant));
      expect(
        Math.abs(correction),
        `${p.en} (${p.tz}, ${p.lon}°): true-solar correction of ${correction.toFixed(0)} min — check the zone`,
      ).toBeLessThan(180);
    }
  });

  it('has no duplicate entries', () => {
    const keys = PLACES.map((p) => `${p.en}|${p.tz}`);
    expect(new Set(keys).size).toBe(keys.length);
    const zh = PLACES.map((p) => p.zh);
    expect(new Set(zh).size).toBe(zh.length);
  });

  it('defaults to Singapore', () => {
    expect(PLACES[DEFAULT_PLACE]!.en).toBe('Singapore');
  });

  it('actually casts a chart for every place without throwing', () => {
    for (const p of PLACES) {
      expect(() => buildChart({
        year: 1990, month: 6, day: 15, hour: 14, minute: 30,
        timeZone: p.tz, longitude: p.lon, gender: 'male', useTrueSolarTime: true,
      }), p.en).not.toThrow();
    }
  });
});

describe('coverage of the places people ask for', () => {
  const has = (en: string) => PLACES.some((p) => p.en === en);

  it('covers Japan, including Gifu', () => {
    for (const city of ['Gifu', 'Tokyo', 'Osaka', 'Kyoto', 'Nagoya', 'Sapporo', 'Fukuoka']) {
      expect(has(city), `missing ${city}`).toBe(true);
    }
  });

  it('covers the regions this app is aimed at', () => {
    for (const city of [
      'Singapore', 'Kuala Lumpur', 'Penang', 'Hong Kong', 'Taipei',
      'Shanghai', 'Beijing', 'Seoul', 'Jakarta', 'Bangkok', 'Manila',
    ]) {
      expect(has(city), `missing ${city}`).toBe(true);
    }
  });

  it('puts Chinese cities on Beijing time, as civil records do', () => {
    // Including Xinjiang and Tibet: a birth certificate there is written in
    // Beijing time, and the longitude carries the real correction.
    const urumqi = PLACES.find((p) => p.en === 'Ürümqi')!;
    expect(urumqi.tz).toBe('Asia/Shanghai');
    expect(urumqi.lon).toBeLessThan(90);

    const instant = Date.UTC(2000, 5, 15, 12);
    const correction = trueSolarCorrectionMinutes(instant, urumqi.lon, offsetMinutes(urumqi.tz, instant));
    // Roughly two hours behind the clock, which is the whole point of tracking it.
    expect(correction).toBeLessThan(-100);
  });

  it('gives Japan a small correction, unlike the rest of East Asia', () => {
    // Japan sits on the 135°E meridian its clock is built from, so Gifu is a
    // few minutes out where Singapore is over an hour.
    const instant = Date.UTC(2000, 5, 15, 12);
    const gifu = PLACES.find((p) => p.en === 'Gifu')!;
    const sg = PLACES.find((p) => p.en === 'Singapore')!;
    const gifuCorr = trueSolarCorrectionMinutes(instant, gifu.lon, offsetMinutes(gifu.tz, instant));
    const sgCorr = trueSolarCorrectionMinutes(instant, sg.lon, offsetMinutes(sg.tz, instant));

    expect(Math.abs(gifuCorr)).toBeLessThan(15);
    expect(Math.abs(sgCorr)).toBeGreaterThan(55);
  });
});

describe('search', () => {
  it('finds a city by either language', () => {
    expect(searchPlaces('gifu').some((p) => p.en === 'Gifu')).toBe(true);
    expect(searchPlaces('岐阜').some((p) => p.en === 'Gifu')).toBe(true);
  });

  it('finds a whole country by either language', () => {
    expect(searchPlaces('japan').some((p) => p.en === 'Gifu')).toBe(true);
    expect(searchPlaces('日本').some((p) => p.en === 'Tokyo')).toBe(true);
    expect(searchPlaces('malaysia').some((p) => p.en === 'Penang')).toBe(true);
  });

  it('finds by IANA zone', () => {
    expect(searchPlaces('Asia/Tokyo').every((p) => p.tz === 'Asia/Tokyo')).toBe(true);
  });

  it('ranks a prefix match above a mere substring', () => {
    const results = searchPlaces('sing');
    expect(results[0]!.en).toBe('Singapore');
  });

  it('is case insensitive', () => {
    expect(searchPlaces('TOKYO')[0]!.en).toBe('Tokyo');
  });

  it('returns nothing for a non-match rather than everything', () => {
    expect(searchPlaces('zzzznowhere')).toHaveLength(0);
  });

  it('returns a browsable list for an empty query', () => {
    expect(searchPlaces('').length).toBeGreaterThan(10);
  });
});
