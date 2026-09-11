/**
 * Short-range outlook: yours alone, or yours and a partner's side by side.
 *
 * Computed, never narrated. The day pillar is the weakest layer in the system
 * and the 时辰 lighter still; spending model tokens to make either read like
 * insight is the exact failure this product is built to avoid.
 */

import { NextResponse } from 'next/server';
import { buildChart } from '../../../src/engine/chart';
import { analyzeStrength } from '../../../src/analyzer/strength';
import { analyzeYongShen } from '../../../src/analyzer/yongshen';
import { forecastRelationship, FORECAST_CAVEAT } from '../../../src/analyzer/topics/forecast';
import { forecastJoint, hourBreakdown, type SideDay } from '../../../src/analyzer/topics/joint';
import { isLocale, type Locale } from '../../../src/i18n/text';
import type { BirthInput } from '../../../src/engine/types';

interface Body extends Partial<BirthInput> {
  locale?: unknown;
  days?: unknown;
  from?: unknown;
  partner?: Partial<BirthInput>;
  /** Ask for the 时辰 breakdown of one date, YYYY-MM-DD. */
  hoursFor?: unknown;
}

const complete = (b: Partial<BirthInput> | undefined): b is BirthInput =>
  !!b && !!b.year && !!b.month && !!b.day && !!b.timeZone && !!b.gender;

const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const locale: Locale = isLocale(body.locale) ? body.locale : 'zh';
  const zh = locale === 'zh';

  // Read the extras before the type guard below narrows `body` to BirthInput
  // and drops them.
  const days = typeof body.days === 'number' ? body.days : 7;
  const from = isDate(body.from) ? new Date(`${body.from}T12:00:00Z`) : new Date();
  const partnerInput = body.partner;
  const hoursFor = body.hoursFor;

  if (!complete(body)) {
    return NextResponse.json(
      { error: zh ? '缺少必要资料。' : 'Missing required details.' },
      { status: 400 },
    );
  }

  try {
    const self = buildChart(body);
    const partner = complete(partnerInput) ? buildChart(partnerInput) : null;

    // Favourable elements colour the hour scoring, so they have to be derived.
    const strength = analyzeStrength(self);
    const favourable = analyzeYongShen(self, strength).favourable;

    const hours = isDate(hoursFor)
      ? hourBreakdown(hoursFor, self, partner, favourable).map((h) => ({
          index: h.index, branch: h.branch, ganZhi: h.ganZhi, range: h.range,
          band: h.band, forYou: h.forYou, forThem: h.forThem,
          notes: h.notes.map((n) => n[locale]),
        }))
      : null;

    if (partner) {
      const f = forecastJoint(self, partner, from, days);
      const side = (x: SideDay) => ({
        band: x.band, tone: x.tone, mode: x.mode, form: x.form,
        notes: x.notes.map((n) => n[locale]),
      });
      return NextResponse.json({
        locale, mode: 'joint',
        from: f.from, to: f.to,
        headline: f.headline[locale],
        caveat: f.caveat[locale],
        hours,
        days: f.days.map((d) => ({
          date: d.date, ganZhi: d.ganZhi, score: d.score,
          yours: side(d.yours),
          theirs: side(d.theirs),
          between: side(d.between),
        })),
      });
    }

    const f = forecastRelationship(self, from, days);
    return NextResponse.json({
      locale, mode: 'solo',
      from: f.from, to: f.to,
      headline: f.headline[locale],
      caveat: FORECAST_CAVEAT[locale],
      quietCount: f.quietCount,
      monthContext: f.monthContext.map((m) => m[locale]),
      standout: f.standout ? { date: f.standout.date, ganZhi: f.standout.ganZhi } : null,
      hours,
      days: f.days.map((d) => ({
        date: d.date, ganZhi: d.ganZhi, band: d.band, tone: d.tone,
        mode: d.mode, form: d.form,
        score: d.score, notes: d.notes.map((n) => n[locale]),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : (zh ? '推算失败。' : 'Could not compute.') },
      { status: 400 },
    );
  }
}
