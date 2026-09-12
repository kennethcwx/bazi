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
import { buildChart, annualLuck, sexagenaryYearOf } from '../../../src/engine/chart';
import { scoreMonths } from '../../../src/analyzer/topics/monthly';
import { analyzeChart } from '../../../src/analyzer/index';
import { renderFinding } from '../../../src/analyzer/findings';
import { findShenSha } from '../../../src/analyzer/shensha';
import { hasModel } from '../../../src/narrator/narrate';
import { composeReading } from '../../../src/narrator/compose';
import { checkGrounding } from '../../../src/narrator/prompt';
import { TEMPLATES } from '../../../src/narrator/templates';
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

    // 流年 for the 大运 currently in force, so the band reads as "this luck
    // period, year by year". Before 起运 (or past the last decade) there is no
    // enclosing 大运, so fall back to the coming ten years from now.
    const nowYear = new Date().getFullYear();
    const decades = analysis.career.decades;
    const active = decades.find((d) => nowYear >= d.startYear && nowYear <= d.endYear);
    const [fromYear, toYear] = active
      ? [active.startYear, active.endYear]
      : [nowYear, nowYear + 9];
    const annual = annualLuck(chart, fromYear, toYear).map((a) => ({
      year: a.year,
      age: a.age,
      ganZhi: a.ganZhi,
      stem: a.stem,
      branch: a.branch,
      stemTenGod: a.stemTenGod,
      branchTenGod: a.branchMainTenGod,
      current: a.year === nowYear,
    }));

    // 流月 for the 流年 in force today. Twelve cells on the decade scale, the
    // month containing today marked; the strip sits under the 流年 band.
    const today = new Date();
    const cycleYear = sexagenaryYearOf(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const months = scoreMonths(chart, analysis.yongShen, cycleYear);
    const asDate = (s: { year: number; month: number; day: number }) => Date.UTC(s.year, s.month - 1, s.day);
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const monthly = months.map((m, i) => {
      const next = months[i + 1];
      const start = asDate(m.starts);
      const end = next ? asDate(next.starts) : start + 32 * 86_400_000;
      return {
        year: m.year,
        index: m.index,
        ganZhi: m.ganZhi,
        stem: m.stem,
        branch: m.branch,
        stemTenGod: m.stemTenGod,
        branchTenGod: m.branchMainTenGod,
        starts: `${m.starts.month}/${m.starts.day}`,
        score: m.score,
        verdict: m.verdict,
        notes: m.notes.map((n) => n[locale]),
        current: todayUtc >= start && todayUtc < end,
      };
    });
    // Every 神煞 hit with the pillar it lands on, so the chart can show them
    // where a practitioner looks for them rather than only inside a finding.
    const shensha = findShenSha(chart).map((s) => ({
      name: s.name, position: s.position, meaning: s.meaning[locale],
    }));
    // With no model configured every reading is composed from the findings —
    // a pure function of the chart, microseconds each. Ship all of them with
    // the chart so a question opens instantly instead of paying a second
    // round trip and a typewriter for text the server already had. When a
    // model is configured the client streams from /api/read as before.
    const readings = hasModel()
      ? null
      : Object.fromEntries(TEMPLATES.map((tpl) => {
          const text = composeReading(analysis, tpl, locale);
          return [tpl.id, { text, grounding: checkGrounding(text, analysis, tpl) }];
        }));
    return NextResponse.json({
      annual,
      monthly,
      shensha,
      readings,
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
        neutral: analysis.yongShen.neutral,
        primaryFamily: analysis.yongShen.primaryFamily,
        climateNeed: analysis.yongShen.climateNeed,
        climateConflict: analysis.yongShen.climateConflict,
        school: analysis.yongShen.school[locale],
        reasoning: analysis.yongShen.reasoning.map((r) => r[locale]),
      },
      structureLens: {
        structure: analysis.structureLens.structure,
        structureEn: analysis.structureLens.structureEn,
        method: analysis.structureLens.method,
        wants: analysis.structureLens.wants,
        fears: analysis.structureLens.fears,
        agreement: analysis.structureLens.agreement,
        reasoning: analysis.structureLens.reasoning.map((r) => r[locale]),
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
