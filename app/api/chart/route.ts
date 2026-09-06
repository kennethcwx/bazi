/**
 * POST a birth, get back a chart and its findings, in one language.
 *
 * The engine and analyzer run server-side so the client never re-derives
 * anything: a reading is a pure function of the birth input, and having one
 * place that computes it is what keeps the cache key honest later.
 *
 * The response is flattened to the requested locale rather than shipping both
 * languages. Sending both would roughly double the payload for a phone on
 * mobile data to display half of it.
 */

import { NextResponse } from 'next/server';
import { buildChart } from '../../../src/engine/chart';
import { analyzeChart } from '../../../src/analyzer/index';
import { renderFinding } from '../../../src/analyzer/findings';
import { isLocale, type Locale } from '../../../src/i18n/text';
import type { BirthInput } from '../../../src/engine/types';

export async function POST(req: Request) {
  let body: Partial<BirthInput> & { locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确。 / Malformed request.' }, { status: 400 });
  }

  const locale: Locale = isLocale(body.locale) ? body.locale : 'zh';
  const zh = locale === 'zh';

  const { year, month, day, timeZone, gender } = body;
  if (!year || !month || !day || !timeZone || !gender) {
    return NextResponse.json(
      {
        error: zh
          ? '缺少必要资料：出生年月日、时区与性别。'
          : 'Missing required details: date of birth, time zone and gender.',
      },
      { status: 400 },
    );
  }

  try {
    const chart = buildChart(body as BirthInput);
    const analysis = analyzeChart(chart);

    return NextResponse.json({
      locale,
      chart,
      strength: {
        elementPercent: analysis.strength.elementPercent,
        familyPercent: analysis.strength.familyPercent,
        supportPercent: analysis.strength.supportPercent,
        verdict: analysis.strength.verdict,
        confidence: analysis.strength.confidence,
        reasoning: analysis.strength.reasoning.map((r) => r[locale]),
      },
      yongShen: {
        primary: analysis.yongShen.primary,
        secondary: analysis.yongShen.secondary,
        favourable: analysis.yongShen.favourable,
        unfavourable: analysis.yongShen.unfavourable,
        primaryFamily: analysis.yongShen.primaryFamily,
        climateNeed: analysis.yongShen.climateNeed,
        climateConflict: analysis.yongShen.climateConflict,
        school: analysis.yongShen.school[locale],
        reasoning: analysis.yongShen.reasoning.map((r) => r[locale]),
      },
      relationship: {
        primaryStar: analysis.relationship.primaryStar,
        findings: analysis.relationship.findings
          .filter((f) => chart.hourKnown || !f.requiresHour)
          .map((f) => renderFinding(f, locale)),
      },
      career: {
        structure: analysis.career.structure,
        lean: analysis.career.lean,
        direction: analysis.career.direction,
        decades: analysis.career.decades.map((d) => ({
          index: d.index,
          startAge: d.startAge,
          endAge: d.endAge,
          startYear: d.startYear,
          endYear: d.endYear,
          ganZhi: d.ganZhi,
          score: d.score,
          verdict: d.verdict,
          notes: d.notes.map((n) => n[locale]),
        })),
        findings: analysis.career.findings
          .filter((f) => chart.hourKnown || !f.requiresHour)
          .map((f) => renderFinding(f, locale)),
      },
    });
  } catch (e) {
    // Surface the real reason — an unknown time zone or an impossible date is
    // the user's to fix, and a generic "something went wrong" helps nobody.
    const message = e instanceof Error ? e.message : (zh ? '排盘失败。' : 'Could not cast the chart.');
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
