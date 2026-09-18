/**
 * 星盘 — a tropical natal chart from a birth instant and place.
 *
 * Positions come from astronomy-engine (VSOP87-based, ~1 arcminute for the
 * planets, better than any stated birth minute deserves). Everything here is
 * geocentric, true ecliptic of date, which is what Western astrology means by
 * a planet's longitude.
 *
 * Houses are whole-sign: the rising sign is the first house, the next sign
 * the second, and so on. Placidus is what 测测 and most apps default to, but it
 * needs trigonometric iteration, fails above the polar circles, and the
 * difference for a phone reading is which side of a cusp a planet lands —
 * whole sign is the older system and never disagrees with itself.
 * ponytail: whole-sign houses; add Placidus if a user compares cusps.
 */

import * as A from 'astronomy-engine';
import { t, type LocalizedText } from '../i18n/text';

export const SIGNS = [
  t('白羊座', 'Aries'), t('金牛座', 'Taurus'), t('双子座', 'Gemini'), t('巨蟹座', 'Cancer'),
  t('狮子座', 'Leo'), t('处女座', 'Virgo'), t('天秤座', 'Libra'), t('天蝎座', 'Scorpio'),
  t('射手座', 'Sagittarius'), t('摩羯座', 'Capricorn'), t('水瓶座', 'Aquarius'), t('双鱼座', 'Pisces'),
] as const;

export const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'] as const;

export type PlanetKey =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';

export const PLANETS: readonly { key: PlanetKey; name: LocalizedText; glyph: string }[] = [
  { key: 'Sun', name: t('太阳', 'Sun'), glyph: '☉' },
  { key: 'Moon', name: t('月亮', 'Moon'), glyph: '☽' },
  { key: 'Mercury', name: t('水星', 'Mercury'), glyph: '☿' },
  { key: 'Venus', name: t('金星', 'Venus'), glyph: '♀' },
  { key: 'Mars', name: t('火星', 'Mars'), glyph: '♂' },
  { key: 'Jupiter', name: t('木星', 'Jupiter'), glyph: '♃' },
  { key: 'Saturn', name: t('土星', 'Saturn'), glyph: '♄' },
  { key: 'Uranus', name: t('天王星', 'Uranus'), glyph: '♅' },
  { key: 'Neptune', name: t('海王星', 'Neptune'), glyph: '♆' },
  { key: 'Pluto', name: t('冥王星', 'Pluto'), glyph: '♇' },
];

export interface Placement {
  readonly key: PlanetKey;
  /** Ecliptic longitude, 0–360. */
  readonly lon: number;
  readonly sign: number;      // 0 = Aries
  readonly degree: number;    // 0–30 within the sign
  readonly retrograde: boolean;
  /** Whole-sign house, 1–12; null when the birth time is unknown. */
  readonly house: number | null;
}

export type AspectKind = 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile';

export interface Aspect {
  readonly a: PlanetKey;
  readonly b: PlanetKey;
  readonly kind: AspectKind;
  /** Distance from exact, in degrees. */
  readonly orb: number;
}

export interface NatalChart {
  readonly planets: readonly Placement[];
  /** Ascendant and Midheaven longitudes; null without a birth time. */
  readonly ascendant: number | null;
  readonly midheaven: number | null;
  readonly aspects: readonly Aspect[];
}

const ASPECTS: readonly { kind: AspectKind; angle: number; orb: number }[] = [
  { kind: 'conjunction', angle: 0, orb: 8 },
  { kind: 'opposition', angle: 180, orb: 8 },
  { kind: 'trine', angle: 120, orb: 7 },
  { kind: 'square', angle: 90, orb: 7 },
  { kind: 'sextile', angle: 60, orb: 5 },
];

const norm = (deg: number): number => ((deg % 360) + 360) % 360;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Geocentric true-ecliptic-of-date longitude of a body at an instant. */
function longitude(key: PlanetKey, date: Date): number {
  if (key === 'Sun') return A.SunPosition(date).elon;
  if (key === 'Moon') return A.EclipticGeoMoon(date).lon;
  return A.Ecliptic(A.GeoVector(A.Body[key], date, true)).elon;
}

/** Whole-sign house of a longitude given the rising sign. */
const houseOf = (lon: number, ascSign: number): number =>
  ((Math.floor(lon / 30) - ascSign + 12) % 12) + 1;

export function computeNatal(input: {
  instantMs: number;
  lat: number;
  lon: number;
  timeKnown: boolean;
}): NatalChart {
  const date = new Date(input.instantMs);
  // An hour later: retrograde is simply longitude decreasing. The Sun and
  // Moon never do, but the check is cheap and uniform.
  const later = new Date(input.instantMs + 3_600_000);

  let ascendant: number | null = null;
  let midheaven: number | null = null;
  if (input.timeKnown) {
    // Local sidereal time in degrees, then the standard ascendant formula.
    const lst = rad(norm(A.SiderealTime(date) * 15 + input.lon));
    const eps = rad(A.e_tilt(A.MakeTime(date)).tobl);
    const phi = rad(input.lat);
    ascendant = norm(deg(Math.atan2(
      Math.cos(lst),
      -(Math.sin(lst) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)),
    )));
    midheaven = norm(deg(Math.atan2(Math.sin(lst), Math.cos(lst) * Math.cos(eps))));
  }
  const ascSign = ascendant === null ? null : Math.floor(ascendant / 30);

  const planets: Placement[] = PLANETS.map(({ key }) => {
    const lon = norm(longitude(key, date));
    const delta = norm(longitude(key, later) - lon);
    return {
      key,
      lon,
      sign: Math.floor(lon / 30),
      degree: lon % 30,
      retrograde: delta > 180,
      house: ascSign === null ? null : houseOf(lon, ascSign),
    };
  });

  const aspects: Aspect[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const sep = Math.abs(((planets[i]!.lon - planets[j]!.lon + 540) % 360) - 180);
      for (const asp of ASPECTS) {
        const orb = Math.abs(sep - asp.angle);
        if (orb <= asp.orb) {
          aspects.push({ a: planets[i]!.key, b: planets[j]!.key, kind: asp.kind, orb });
          break;
        }
      }
    }
  }
  aspects.sort((x, y) => x.orb - y.orb);

  return { planets, ascendant, midheaven, aspects };
}
