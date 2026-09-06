/**
 * Short-range relationship outlook: 流日 over a window of days.
 *
 * Computed, never narrated. The day pillar is the weakest layer in the system
 * and spending model tokens to make it read like insight would be the exact
 * failure this product is built to avoid.
 */

import { NextResponse } from 'next/server';
import { buildChart } from '../../../src/engine/chart';
import { forecastRelationship, FORECAST_CAVEAT } from '../../../src/analyzer/topics/forecast';
import { isLocale, type Locale } from '../../../src/i18n/text';
import type { BirthInput } from '../../../src/engine/types';

export async function POST(req: Request) {
  let body: Partial<BirthInput> & { locale?: unknown; days?: unknown; from?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const locale: Locale = isLocale(body.locale) ? body.locale : 'zh';
  const zh = locale === 'zh';

  const { year, month, day, timeZone, gender } = body;
  if (!year || !month || !day || !timeZone || !gender) {
    return NextResponse.json(
      { error: zh ? '缺少必要资料。' : 'Missing required details.' },
      { status: 400 },
    );
  }

  const days = typeof body.days === 'number' ? body.days : 7;
  // Default to today in UTC. The window is days, so an hour either way is noise.
  const from = typeof body.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.from)
    ? new Date(`${body.from}T12:00:00Z`)
    : new Date();

  try {
    const chart = buildChart(body as BirthInput);
    const f = forecastRelationship(chart, from, days);

    return NextResponse.json({
      locale,
      from: f.from,
      to: f.to,
      headline: f.headline[locale],
      caveat: FORECAST_CAVEAT[locale],
      quietCount: f.quietCount,
      monthContext: f.monthContext.map((m) => m[locale]),
      standout: f.standout ? { date: f.standout.date, ganZhi: f.standout.ganZhi } : null,
      days: f.days.map((d) => ({
        date: d.date,
        ganZhi: d.ganZhi,
        band: d.band,
        tone: d.tone,
        score: d.score,
        notes: d.notes.map((n) => n[locale]),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : (zh ? '推算失败。' : 'Could not compute.') },
      { status: 400 },
    );
  }
}
