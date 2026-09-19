/**
 * POST two births, get back a 合盘: five factor scores with a line each,
 * house overlays and the cross-aspect list, flattened to one locale.
 */

import { NextResponse } from 'next/server';
import { castBirth, type BirthInput } from '../../../src/astro/cast';
import { aspectText, computeSynastry, FACTOR_NAME, overlayText } from '../../../src/astro/synastry';
import { isLocale, type Locale } from '../../../src/i18n/text';

export async function POST(req: Request) {
  let body: { a?: BirthInput; b?: BirthInput; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确。 / Malformed request.' }, { status: 400 });
  }
  const locale: Locale = isLocale(body.locale) ? body.locale : 'zh';
  const a = body.a && typeof body.a === 'object' ? castBirth(body.a) : null;
  const b = body.b && typeof body.b === 'object' ? castBirth(body.b) : null;
  if (!a || !b) {
    return NextResponse.json(
      { error: locale === 'zh' ? '两人的出生日期与地点都需要。' : 'Both births need a date and a place.' },
      { status: 400 },
    );
  }
  const s = computeSynastry(a.chart, b.chart);
  return NextResponse.json({
    overall: s.overall,
    timeKnown: { a: a.timeKnown, b: b.timeKnown },
    factors: s.factors.map((f) => ({
      factor: f.factor, name: FACTOR_NAME[f.factor][locale], score: f.score,
      source: f.source?.[locale] ?? null, text: f.text[locale],
    })),
    overlays: s.overlays.map((o) => ({ of: o.of, text: overlayText(o)[locale] })),
    aspects: s.aspects.slice(0, 10).map((x) => ({ text: aspectText(x)[locale], orb: +x.orb.toFixed(1) })),
  });
}
