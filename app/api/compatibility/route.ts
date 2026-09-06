/**
 * 合婚 — two charts read against each other.
 *
 * Both charts are cast server-side from raw birth details rather than accepting
 * a computed chart from the client, for the same reason the reading endpoint
 * does: findings are the only permitted source of truth downstream, so they
 * must not be forgeable.
 */

import { NextResponse } from 'next/server';
import { buildChart } from '../../../src/engine/chart';
import { analyzeStrength } from '../../../src/analyzer/strength';
import { analyzeYongShen } from '../../../src/analyzer/yongshen';
import { analyzeCompatibility } from '../../../src/analyzer/topics/compatibility';
import { renderFinding } from '../../../src/analyzer/findings';
import { isLocale, type Locale } from '../../../src/i18n/text';
import type { BirthInput } from '../../../src/engine/types';

function side(input: BirthInput) {
  const chart = buildChart(input);
  const strength = analyzeStrength(chart);
  return { chart, strength, yongShen: analyzeYongShen(chart, strength) };
}

const complete = (b: Partial<BirthInput> | undefined): b is BirthInput =>
  !!b && !!b.year && !!b.month && !!b.day && !!b.timeZone && !!b.gender;

export async function POST(req: Request) {
  let body: { self?: Partial<BirthInput>; partner?: Partial<BirthInput>; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const locale: Locale = isLocale(body.locale) ? body.locale : 'zh';
  const zh = locale === 'zh';

  if (!complete(body.self) || !complete(body.partner)) {
    return NextResponse.json(
      {
        error: zh
          ? '合婚需要两个人的出生年月日、时区与性别。'
          : 'Compatibility needs date of birth, time zone and gender for both people.',
      },
      { status: 400 },
    );
  }

  try {
    const a = side(body.self);
    const b = side(body.partner);
    const c = analyzeCompatibility(a, b);

    return NextResponse.json({
      locale,
      self: {
        pillars: [a.chart.pillars.year, a.chart.pillars.month, a.chart.pillars.day, a.chart.pillars.hour]
          .map((p) => p?.ganZhi ?? null),
        dayMaster: a.chart.dayMaster,
        favourable: a.yongShen.favourable,
      },
      partner: {
        pillars: [b.chart.pillars.year, b.chart.pillars.month, b.chart.pillars.day, b.chart.pillars.hour]
          .map((p) => p?.ganZhi ?? null),
        dayMaster: b.chart.dayMaster,
        favourable: b.yongShen.favourable,
      },
      supplyToSelf: c.supplyToA,
      supplyToPartner: c.supplyToB,
      findings: c.findings.map((f) => renderFinding(f, locale)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : (zh ? '合婚推算失败。' : 'Could not compute.') },
      { status: 400 },
    );
  }
}
