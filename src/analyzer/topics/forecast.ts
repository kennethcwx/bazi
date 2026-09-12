/**
 * 流日 / 流月 — the short-range relationship outlook.
 *
 * A caution that shapes the whole file: **this is the weakest layer in the
 * system.** 大运 moves a decade, 流年 moves a year, and a 流日 nudges a mood.
 * Classical practice treats the day pillar as a minor influence read on top of
 * the larger cycles, not as a forecast in its own right.
 *
 * So this is built deliberately modestly:
 *
 *  - It reports what is being touched (夫妻宫, 配偶星) and what that classically
 *    means, rather than predicting an outcome.
 *  - It grades days as notable / mild / quiet, not good / bad.
 *  - It says out loud that most days are quiet, because they are — a forecast
 *    that finds something every day is measuring nothing.
 *  - It is computed, never narrated by a model. Spending tokens dressing up a
 *    weak signal is how this kind of product starts lying.
 */

import { transitPillars } from '../../engine/chart';
import type { Chart } from '../../engine/types';
import { t, type LocalizedText } from '../../i18n/text';
import { RELATION } from '../../i18n/glossary';
import { findRelations, isBranchRelation, natalPillars, RELATION_WEIGHT } from '../relations';
import { analyzeStrength } from '../strength';
import { analyzeYongShen } from '../yongshen';
import {
  MODE_LABEL, readPalaceLayer, readPersonDay, stackNote, stackedOn,
  type Band, type Favour, type Form, type Layer, type LayerRead, type Mode,
} from './dayread';

// 旺衰 grades on the same table now, so it lives in relations.ts. Re-exported
// here because joint.ts and the tests already import them from this module.
export { natalPillars, RELATION_WEIGHT };
export type { Band, Form, Mode } from './dayread';

/** 时辰 midpoints. 子 centres on midnight because it runs 23:00-01:00. */
export const HOUR_MIDPOINTS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] as const;

export const HOUR_RANGES: readonly string[] = [
  '23:00–01:00', '01:00–03:00', '03:00–05:00', '05:00–07:00',
  '07:00–09:00', '09:00–11:00', '11:00–13:00', '13:00–15:00',
  '15:00–17:00', '17:00–19:00', '19:00–21:00', '21:00–23:00',
];

export interface DayOutlook {
  /** ISO date, YYYY-MM-DD. */
  readonly date: string;
  readonly ganZhi: string;
  readonly score: number;
  readonly band: Band;
  /** What the day does — close, stirred, friction, apart — or quiet. */
  readonly mode: Mode;
  /** Whether the day's elements feed you or drain you. Background, unscored. */
  readonly form: Form;
  /** What is being touched, and what that classically indicates. */
  readonly notes: readonly LocalizedText[];
  /** Harmonising days read as ease; disturbing ones as friction. Null when
   *  the relation hits balance out or none reach the palace. */
  readonly tone: 'easy' | 'friction' | null;
  /** The 流年 / 流月 whose mode this day shares — empty for a quiet day. */
  readonly stacked: readonly Layer[];
}

export interface ForecastSummary {
  readonly from: string;
  readonly to: string;
  readonly days: readonly DayOutlook[];
  /** The day most worth knowing about, if any stands out. */
  readonly standout: DayOutlook | null;
  readonly quietCount: number;
  /** The 流月 context, which applies across the whole window. */
  readonly monthContext: readonly LocalizedText[];
  /** The 流年 and 流月 the window sits in, read against the palace. */
  readonly layers: { readonly year: LayerRead; readonly month: LayerRead };
  readonly headline: LocalizedText;
}

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** The favourable/unfavourable elements the day is read against. */
export function favourOf(chart: Chart): Favour {
  const y = analyzeYongShen(chart, analyzeStrength(chart));
  return { favourable: y.favourable, unfavourable: y.unfavourable };
}

/** The 流年 and 流月 a date sits in, read against the palace. */
export function layersOf(chart: Chart, date: Date): { year: LayerRead; month: LayerRead } {
  const p = transitPillars(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  const td = (c: { getHeavenStem(): { getName(): string }; getEarthBranch(): { getName(): string } }) =>
    ({ stem: c.getHeavenStem().getName(), branch: c.getEarthBranch().getName() });
  return {
    year: readPalaceLayer(chart, td(p.year), '流年'),
    month: readPalaceLayer(chart, td(p.month), '流月'),
  };
}

/**
 * Score one day against the natal chart, through the relationship lens.
 * With `layers`, a registering day that shares a layer's mode is marked as
 * stacked on it and says so in its notes; its score and band do not move.
 */
export function scoreDay(
  chart: Chart, date: Date, favour: Favour,
  layers?: { year: LayerRead; month: LayerRead },
): DayOutlook {
  const dayCycle = transitPillars(
    date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
  ).day;
  const read = readPersonDay(chart, favour, {
    stem: dayCycle.getHeavenStem().getName(),
    branch: dayCycle.getEarthBranch().getName(),
  });
  const stacked = layers ? stackedOn(read.mode, [layers.year, layers.month]) : [];
  return {
    date: iso(date),
    ganZhi: dayCycle.getName(),
    score: read.score,
    band: read.band,
    mode: read.mode,
    form: read.form,
    notes: stacked.length ? [...read.notes, stackNote(read.mode, stacked)] : read.notes,
    tone: read.balance > 0 ? 'easy' : read.balance < 0 ? 'friction' : null,
    stacked,
  };
}

/**
 * The relationship outlook over a window of days.
 *
 * `days` is capped: past a month the day pillar tells you nothing you could not
 * get from the 流年 reading, and a long list invites the reader to treat noise
 * as signal.
 */
export function forecastRelationship(
  chart: Chart,
  fromDate: Date,
  days = 7,
): ForecastSummary {
  const span = Math.max(1, Math.min(31, days));
  const favour = favourOf(chart);
  const natal = natalPillars(chart);
  const out: DayOutlook[] = [];
  const start = Date.UTC(
    fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate(),
  );
  // 流年 and 流月 apply across the window rather than to any one day. Read
  // at the midpoint; a 30-day window can straddle a 节 or 立春, and the
  // midpoint is the least wrong single answer.
  const mid = new Date(start + Math.floor(span / 2) * 86_400_000);
  const layers = layersOf(chart, mid);

  for (let i = 0; i < span; i++) {
    out.push(scoreDay(chart, new Date(start + i * 86_400_000), favour, layers));
  }

  const monthPillar = transitPillars(
    mid.getUTCFullYear(), mid.getUTCMonth() + 1, mid.getUTCDate(),
  ).month;
  const monthContext: LocalizedText[] = [];
  for (const r of findRelations([
    ...natal,
    { position: '流月', stem: monthPillar.getHeavenStem().getName(), branch: monthPillar.getEarthBranch().getName() },
  ])) {
    if (!r.positions.includes('流月') || !r.positions.includes('日柱') || !isBranchRelation(r)) continue;
    const rel = RELATION[r.kind]!;
    monthContext.push(
      r.polarity === 'harmonising'
        ? t(
            `本月${monthPillar.getName()}与夫妻宫${r.label}，整月气氛偏顺`,
            `This month (${monthPillar.getName()}) forms ${rel.en} with your Spouse ` +
              `Palace — the background tone for the whole period is easier`,
          )
        : t(
            `本月${monthPillar.getName()}${r.label}夫妻宫，整月易有拉扯`,
            `This month (${monthPillar.getName()}) brings ${rel.en} to your Spouse ` +
              `Palace — expect more pulling back and forth across the period`,
          ),
    );
  }

  const ranked = [...out].sort((a, b) => b.score - a.score);
  const standout = ranked[0] && ranked[0].band !== 'quiet' ? ranked[0] : null;
  const quietCount = out.filter((d) => d.band === 'quiet').length;

  const headline: LocalizedText = standout
    ? t(
        `这${span}天里，${standout.date} 最值得留意` +
          `（${standout.ganZhi}，${MODE_LABEL[standout.mode].zh}）。` +
          `其余 ${quietCount} 天平平，没有特别的牵动。`,
        `Across these ${span} days, ${standout.date} is the one worth noting ` +
          `(${standout.ganZhi} — ${MODE_LABEL[standout.mode].en}). ` +
          `The other ${quietCount} are quiet, with nothing particular in play.`,
      )
    : t(
        `这${span}天没有明显牵动夫妻宫的日子——多数日子本来就是如此，` +
          `流日在八字里本就是最轻的一层。`,
        `Nothing in these ${span} days meaningfully touches your Spouse Palace. ` +
          `That is the normal state of affairs — the day pillar is the lightest ` +
          `layer in this system, and most days genuinely carry no signal.`,
      );

  return {
    from: iso(new Date(start)),
    to: iso(new Date(start + (span - 1) * 86_400_000)),
    days: out,
    standout,
    quietCount,
    monthContext,
    layers,
    headline,
  };
}

/** The caveat, in one place, so every surface that shows a forecast repeats it. */
export const FORECAST_CAVEAT: LocalizedText = t(
  '流日是八字里最轻的一层。大运定十年，流年定一年，流日只动当天的一点气氛。' +
    '这里讲的是今天动到了什么。它不讲吉凶，也别拿它做决定。',
  'The day pillar is the lightest layer in BaZi. A luck pillar shapes a decade; ' +
    'a day pillar nudges a mood. This tells you what today touches. It does not ' +
    'tell you whether today is lucky, and you should not decide anything on it.',
);
