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
import type { Chart, TenGod } from '../../engine/types';
import { t, type LocalizedText } from '../../i18n/text';
import { RELATION, TEN_GOD } from '../../i18n/glossary';
import { elementOfBranch, elementOfStem, tenGodFamily, FAMILY_OF } from '../elements';
import { findRelations, isBranchRelation, type PositionedPillar, type RelationKind } from '../relations';

/**
 * Not every relation carries the same weight, and treating them alike is how a
 * day forecast turns into noise.
 *
 * 六合, 三合 and 冲 are the ones classical practice actually reads on a day.
 * 害, 破 and 自刑 are minor blemishes — real, but not enough on their own to
 * say anything about a day. Weighted so that a minor relation alone leaves the
 * day quiet, which is what it should be.
 */
const RELATION_WEIGHT: Record<RelationKind, number> = {
  六合: 3, 三合: 3, 三会: 3, 六冲: 3,
  半合: 2, 相刑: 2,
  相害: 1, 相破: 1, 自刑: 1,
  // Stem relations never reach the palace; filtered out before this is used.
  天干五合: 0, 天干相冲: 0,
};

/** 桃花 lookup, duplicated narrowly here to keep the forecast self-contained. */
const PEACH: Record<string, string> = {
  申: '酉', 子: '酉', 辰: '酉',
  亥: '子', 卯: '子', 未: '子',
  寅: '卯', 午: '卯', 戌: '卯',
  巳: '午', 酉: '午', 丑: '午',
};

export type Band = 'notable' | 'mild' | 'quiet';

export interface DayOutlook {
  /** ISO date, YYYY-MM-DD. */
  readonly date: string;
  readonly ganZhi: string;
  readonly score: number;
  readonly band: Band;
  /** What is being touched, and what that classically indicates. */
  readonly notes: readonly LocalizedText[];
  /** Harmonising days read as ease; disturbing ones as friction. Null when
   *  nothing meaningful is in play, which is most days. */
  readonly tone: 'easy' | 'friction' | null;
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
  readonly headline: LocalizedText;
}

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/**
 * Score one day against the natal chart.
 *
 * Only relations that reach 日柱 count — the marriage palace is the day branch,
 * and a 流日 clashing some other pillar is not a relationship signal.
 */
function scoreDay(
  chart: Chart,
  date: Date,
  primaryStar: TenGod,
  secondaryStar: TenGod,
  natal: readonly PositionedPillar[],
): DayOutlook {
  const pillars = transitPillars(
    date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
  );
  const dayCycle = pillars.day;
  const stem = dayCycle.getHeavenStem();
  const branch = dayCycle.getEarthBranch();

  const withTransit: PositionedPillar[] = [
    ...natal,
    { position: '流日', stem: stem.getName(), branch: branch.getName() },
  ];

  const notes: LocalizedText[] = [];
  let score = 0;
  let harmonising = 0;
  let disturbing = 0;


  for (const r of findRelations(withTransit)) {
    if (!r.positions.includes('流日')) continue;
    if (!r.positions.includes('日柱')) continue;
    if (!isBranchRelation(r)) continue;

    const rel = RELATION[r.kind]!;
    const weight = RELATION_WEIGHT[r.kind];
    if (weight === 0) continue;

    if (r.polarity === 'harmonising') {
      score += weight;
      harmonising++;
      notes.push(t(
        `${r.label}，动夫妻宫——较易亲近、谈得开`,
        `${rel.en} with your Spouse Palace (${r.values.join('–')}) — an easier day ` +
          `for closeness and for saying the thing you have been putting off`,
      ));
    } else {
      score += weight;
      disturbing++;
      notes.push(t(
        `${r.label}，冲扰夫妻宫——易起摩擦，不宜在此日逼决定`,
        `${rel.en} against your Spouse Palace (${r.values.join('–')}) — friction is ` +
          `likelier; a poor day to force a decision`,
      ));
    }
  }

  // The spouse star arriving on the day. Worth +1, not more: the 财 or 官
  // family lands on roughly two days in five, so on its own it is background
  // rather than an event. It colours a day the palace has already engaged.
  const stemGod = tenGodFamily(chart.dayMasterElement, elementOfStem(stem.getName()));
  const branchGod = tenGodFamily(chart.dayMasterElement, elementOfBranch(branch.getName()));
  const starFamily = FAMILY_OF[primaryStar];

  if (stemGod === starFamily || branchGod === starFamily) {
    score += 1;
    notes.push(t(
      `流日${dayCycle.getName()}带${primaryStar}气`,
      `${dayCycle.getName()} carries ${TEN_GOD[primaryStar]!.en}`,
    ));
  }

  // 桃花 landing on the day: attraction, attention, being noticed.
  const peachFromYear = PEACH[chart.pillars.year.branch];
  const peachFromDay = PEACH[chart.pillars.day.branch];
  if (branch.getName() === peachFromYear || branch.getName() === peachFromDay) {
    score += 1;
    notes.push(t(
      '流日逢桃花，异性缘与场面上的注意力较旺',
      'Peach Blossom falls today — attention and attraction run a little higher',
    ));
  }

  void secondaryStar;

  // A single minor relation, or a bare spouse-star day, scores 1 and stays
  // quiet. Reaching 'mild' takes a real relation or two small signals together.
  const band: Band = score >= 4 ? 'notable' : score >= 2 ? 'mild' : 'quiet';
  const tone = harmonising > disturbing ? 'easy'
    : disturbing > harmonising ? 'friction'
    : null;

  return {
    date: iso(date),
    ganZhi: dayCycle.getName(),
    score,
    band,
    notes,
    tone,
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
  const isMale = chart.gender === 'male';
  const primaryStar: TenGod = isMale ? '正财' : '正官';
  const secondaryStar: TenGod = isMale ? '偏财' : '七杀';

  const natal: PositionedPillar[] = [
    { position: '年柱', stem: chart.pillars.year.stem, branch: chart.pillars.year.branch },
    { position: '月柱', stem: chart.pillars.month.stem, branch: chart.pillars.month.branch },
    { position: '日柱', stem: chart.pillars.day.stem, branch: chart.pillars.day.branch },
    ...(chart.pillars.hour
      ? [{ position: '时柱', stem: chart.pillars.hour.stem, branch: chart.pillars.hour.branch }]
      : []),
  ];

  const out: DayOutlook[] = [];
  const start = Date.UTC(
    fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate(),
  );
  for (let i = 0; i < span; i++) {
    out.push(scoreDay(chart, new Date(start + i * 86_400_000), primaryStar, secondaryStar, natal));
  }

  // 流月 applies across the window rather than to any one day.
  const mid = new Date(start + Math.floor(span / 2) * 86_400_000);
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
          `（${standout.ganZhi}，${standout.tone === 'easy' ? '偏顺' : standout.tone === 'friction' ? '易有摩擦' : '有所牵动'}）。` +
          `其余 ${quietCount} 天平平，没有特别的牵动。`,
        `Across these ${span} days, ${standout.date} is the one worth noting ` +
          `(${standout.ganZhi} — ${standout.tone === 'easy' ? 'easier' : standout.tone === 'friction' ? 'more friction' : 'active'}). ` +
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
