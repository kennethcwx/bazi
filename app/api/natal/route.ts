/**
 * POST a birth, get back a 星盘: placements, angles, aspects and a reading,
 * flattened to one locale like /api/chart.
 */

import { NextResponse } from 'next/server';
import { PLANETS, SIGNS, SIGN_GLYPHS } from '../../../src/astro/natal';
import { castBirth } from '../../../src/astro/cast';
import { readNatal } from '../../../src/astro/readings';
import { computeTransits, readDaily, LENS_NAME } from '../../../src/astro/transits';
import { isLocale, type Locale } from '../../../src/i18n/text';

export async function POST(req: Request) {
  let body: {
    date?: unknown; time?: unknown; timeKnown?: unknown; placeIndex?: unknown; locale?: unknown; now?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确。 / Malformed request.' }, { status: 400 });
  }
  const locale: Locale = isLocale(body.locale) ? body.locale : 'zh';

  const cast = castBirth(body);
  if (!cast) {
    return NextResponse.json(
      { error: locale === 'zh' ? '缺少出生日期或地点。' : 'Missing birth date or place.' },
      { status: 400 },
    );
  }
  const { chart, timeKnown } = cast;
  const reading = readNatal(chart);
  // The client's clock, so "today" is the reader's day, not the server's.
  const nowMs = typeof body.now === 'number' && Number.isFinite(body.now) ? body.now : Date.now();
  const daily = readDaily(computeTransits(chart, nowMs));

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
    daily: {
      moon: daily.moon[locale],
      lenses: daily.lenses.map((l) => ({
        lens: l.lens, name: LENS_NAME[l.lens][locale], stars: l.stars,
        source: l.source?.[locale] ?? null, text: l.text[locale],
      })),
    },
  });
}
