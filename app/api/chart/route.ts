/**
 * POST a birth, get back a chart and its findings.
 *
 * The engine and analyzer run server-side so the client never re-derives
 * anything: a reading is a pure function of the birth input, and having one
 * place that computes it is what keeps the cache key honest later.
 */

import { NextResponse } from 'next/server';
import { buildChart } from '../../../src/engine/chart';
import { analyzeChart } from '../../../src/analyzer/index';
import type { BirthInput } from '../../../src/engine/types';

export async function POST(req: Request) {
  let body: Partial<BirthInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确。' }, { status: 400 });
  }

  const { year, month, day, timeZone, gender } = body;
  if (!year || !month || !day || !timeZone || !gender) {
    return NextResponse.json(
      { error: '缺少必要资料：出生年月日、时区与性别。' },
      { status: 400 },
    );
  }

  try {
    const chart = buildChart(body as BirthInput);
    const analysis = analyzeChart(chart);
    return NextResponse.json({
      chart,
      strength: analysis.strength,
      yongShen: analysis.yongShen,
      relationship: {
        findings: analysis.relationship.findings,
        primaryStar: analysis.relationship.primaryStar,
      },
      career: {
        findings: analysis.career.findings,
        decades: analysis.career.decades,
        structure: analysis.career.structure,
        lean: analysis.career.lean,
      },
    });
  } catch (e) {
    // Surface the real reason — an unknown time zone or an impossible date is
    // the user's to fix, and a generic "something went wrong" helps nobody.
    const message = e instanceof Error ? e.message : '排盘失败。';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
