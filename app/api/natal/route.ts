/**
 * POST a birth, get back a 星盘: placements, angles, aspects and a reading,
 * flattened to one locale like /api/chart.
 */

import { NextResponse } from 'next/server';
import { computeNatal, PLANETS, SIGNS, SIGN_GLYPHS } from '../../../src/astro/natal';
import { readNatal } from '../../../src/astro/readings';
import { wallClockToInstant } from '../../../src/engine/moment';
import { PLACES } from '../../../src/places';
import { isLocale, type Locale } from '../../../src/i18n/text';

export async function POST(req: Request) {
  let body: {
    date?: unknown; time?: unknown; timeKnown?: unknown; placeIndex?: unknown; locale?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确。 / Malformed request.' }, { status: 400 });
  }
  const locale: Locale = isLocale(body.locale) ? body.locale : 'zh';

  const m = typeof body.date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(body.date) : null;
  const place = typeof body.placeIndex === 'number' ? PLACES[body.placeIndex] : undefined;
  if (!m || !place) {
    return NextResponse.json(
      { error: locale === 'zh' ? '缺少出生日期或地点。' : 'Missing birth date or place.' },
      { status: 400 },
    );
  }
  const timeKnown = body.timeKnown !== false && typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time);
  // Without a time, noon: the Moon moves ~13° a day, so this keeps it within
  // about a sign's fifth of the truth, and everything else barely moves.
  const [hour, minute] = timeKnown ? (body.time as string).split(':').map(Number) : [12, 0];

  const { instantMs } = wallClockToInstant(
    { year: +m[1]!, month: +m[2]!, day: +m[3]!, hour: hour!, minute: minute! },
    place.tz,
  );
  const chart = computeNatal({ instantMs, lat: place.lat, lon: place.lon, timeKnown });
  const reading = readNatal(chart);

  // Round before splitting into sign and degree, or 29.96° prints as "30.0°"
  // of the sign it has, to one decimal, already left.
  const signOf = (lon: number) => {
    const r = (Math.round(lon * 10) / 10) % 360;
    const s = Math.floor(r / 30);
    return { lon, sign: SIGNS[s]![locale], signGlyph: SIGN_GLYPHS[s]!, degree: +(r - s * 30).toFixed(1) };
  };
  return NextResponse.json({
    timeKnown,
    planets: chart.planets.map((p) => ({
      key: p.key,
      name: PLANETS.find((x) => x.key === p.key)!.name[locale],
      glyph: PLANETS.find((x) => x.key === p.key)!.glyph,
      ...signOf(p.lon),
      retrograde: p.retrograde,
      house: p.house,
    })),
    ascendant: chart.ascendant === null ? null : signOf(chart.ascendant),
    midheaven: chart.midheaven === null ? null : signOf(chart.midheaven),
    aspects: chart.aspects.map((a) => ({ ...a, orb: +a.orb.toFixed(1) })),
    reading: {
      sun: reading.sun[locale],
      moon: reading.moon[locale],
      ascendant: reading.ascendant?.[locale] ?? null,
      placements: reading.placements.map((r) => r[locale]),
      aspects: reading.aspects.map((r) => r[locale]),
    },
  });
}
