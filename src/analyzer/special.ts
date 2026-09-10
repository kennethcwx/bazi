/**
 * 化气格 and 专旺格 — the last two structures that read a chart by its dominant
 * element instead of by 扶抑.
 *
 * WHY THESE LIVE BESIDE 从格 RATHER THAN INSIDE IT. ./following already makes
 * one judgement of this shape: a chart so lopsided that balancing it is the
 * wrong question, so the reading goes with the dominant force instead. 从格 is
 * the surrender case — the Day Master is overwhelmed and gives in. These two
 * are the other halves of the same idea:
 *
 *   专旺格 — the Day Master is not overwhelmed but overwhelming. The branches
 *     have gathered into a single element and the chart IS that element. There
 *     is nothing to balance, and opposing it is what breaks it.
 *   化气格 — the Day Master is neither strong nor weak but transformed. It has
 *     combined with an adjacent stem (天干五合) and, with the season behind the
 *     combination, become a different element altogether.
 *
 * All three invert 用神, and that inversion is the only reason any of them is
 * worth computing: a 曲直格 read as an ordinary 身强 chart is told to take 官杀
 * — the exact element that wrecks it. Getting this wrong is not imprecision,
 * it is the opposite advice.
 *
 * ── 化气格, and the conditions ──────────────────────────────────────────────
 *
 * 甲己合土, 乙庚合金, 丙辛合水, 丁壬合木, 戊癸合火. A combination is not a
 * transformation, and the gap between 合 and 化 is where most bad readings of
 * this 格 come from. Required, all of them:
 *
 *   1. 日干 combines with the 月干 or the 时干. The 年干 is too far — 遥合不化
 *      is standard — and the 日干 has to be one of the two partners, because it
 *      is the thing being transformed.
 *   2. 月令 carries the 化神. The classical month tables (化土 wants 辰戌丑未,
 *      化金 wants 巳酉丑申, and so on) are exactly "the month branch is the 化神
 *      element, or it sits in the 三合 triangle that produces it", so that is
 *      how the condition is written rather than as five hard-coded lists.
 *   3. 化神 has real weight in the chart. A transformation into an element that
 *      is barely present is a claim about nothing.
 *   4. 无争合 — no third stem competing for either partner. Two 己 reaching for
 *      one 甲 is 争合, and a contested combination does not transform.
 *   5. 化神不受克 — no other visible stem controls the 化神. The partners
 *      themselves are exempt: they are bound in the combination and no longer
 *      acting on their own account (戊癸化火 would otherwise break itself, 癸
 *      being Water).
 *   6. 日主无根. A Day Master with somewhere to stand does not become something
 *      else; that is 合而不化. Two tests, because one number cannot say it:
 *      日坐本气根 is rejected outright — a Day Master sitting on its own element
 *      has the strongest root there is, and position matters here in a way a
 *      whole-chart percentage flattens away — and the weighted share is capped
 *      besides, so a root scattered across the remaining branches also breaks
 *      it. What survives is 假化: a 中气 or 余气 trace, or a light root far from
 *      the Day Master. The cap is deliberately strict, because the two errors
 *      are not symmetrical — a 化气格 missed is read by 扶抑 and comes out
 *      ordinary, while a 化气格 asserted wrongly inverts every piece of advice
 *      in the reading.
 *   7. The 化神 is not already the Day Master's own element. 化 means becoming
 *      something else, and the 格 is named for what the 日主 turns into — so a
 *      己 Day Master "transforming" into 土 by 甲己合 has not transformed at
 *      all. The classical pair tables read from either side, but the 格 belongs
 *      to the partner who changes; a chart on the other side of the combination
 *      is read by 扶抑, or by 专旺 if it qualifies. Without this the analyzer
 *      would also assert 真化 on the strength of a root of zero and then say the
 *      Day Master has no element left to stand on, in a chart where that
 *      element holds half the weight — a claim its own numbers contradict.
 *
 * 真化 / 假化 follows the convention 从格 uses: 真化 when the old self is gone
 * entirely, 假化 when a trace of it survives.
 *
 * ── 专旺格 (一行得气), and the conditions ────────────────────────────────────
 *
 * 曲直 (木), 炎上 (火), 稼穑 (土), 从革 (金), 润下 (水). Required:
 *
 *   1. 月令 is the Day Master's own element.
 *   2. 支成方局 — the branches form a complete 三合 or 三会 of that element.
 *      This is the classical requirement and it is what keeps the 格 rare.
 *      土 is the exception and has to be: there is no 三合土局 in the tables at
 *      all, so 稼穑 is taken on 支全四库 (three or more of 辰戌丑未) instead.
 *   3. 不见官杀 — nothing visible controls the Day Master. One 官杀 stem and
 *      the chart is fighting rather than flowing, which is 破格.
 *   4. The element genuinely dominates, on the same weighting 旺衰 uses.
 *
 * 喜忌 for 专旺 are the classical ones, and they agree across all five: 比劫 is
 * the 旺神 itself, 食伤 is the outlet that lets it flow (木火通明, 金水相涵),
 * 印 feeds it. 官杀 and 财 are 忌 — one opposes the force, the other provokes
 * 群劫争财.
 */

import type { Chart, Element } from '../engine/types';
import { t, type LocalizedText } from '../i18n/text';
import { ELEMENT } from '../i18n/glossary';
import {
  controls, controlledBy, elementOfBranch, generatedBy, generates,
} from './elements';
import { findRelations, natalPillars } from './relations';

export type SpecialCategory = '化气' | '专旺';

export interface SpecialStructure {
  /** 化土格, 曲直格 … — the name as a Chinese chart would write it. */
  readonly kind: string;
  readonly category: SpecialCategory;
  /** 化神 for 化气, 旺神 for 专旺. The element the whole reading turns on. */
  readonly element: Element;
  /** 真化 / a clean 专旺 — nothing survives to contest the structure. */
  readonly genuine: boolean;
  /** 用神 first, then 喜神 — elements rather than families, because a 化气 chart
   *  no longer stands where its 十神 were measured from. */
  readonly favourable: readonly Element[];
  readonly unfavourable: readonly Element[];
  readonly reasoning: readonly LocalizedText[];
}

/** The 三合 triangle that produces each element. 土 has none — see the header. */
const TRIPLE_OF: Record<Element, readonly string[]> = {
  水: ['申', '子', '辰'],
  木: ['亥', '卯', '未'],
  火: ['寅', '午', '戌'],
  金: ['巳', '酉', '丑'],
  土: [],
};

/** 三会方 — the seasonal trio for each element. 土 again has none. */
const DIRECTIONAL_OF: Record<Element, readonly string[]> = {
  木: ['寅', '卯', '辰'],
  火: ['巳', '午', '未'],
  金: ['申', '酉', '戌'],
  水: ['亥', '子', '丑'],
  土: [],
};

/** 四库 — the four earth stores, which is what 稼穑 is taken on instead. */
const EARTH_STORES = new Set(['辰', '戌', '丑', '未']);

const DOMINANT_NAME: Record<Element, string> = {
  木: '曲直格', 火: '炎上格', 土: '稼穑格', 金: '从革格', 水: '润下格',
};

/** Pillar labels in English, for the reasoning. The Chinese labels are chart
 *  notation and do not belong in an English sentence. */
const POSITION_EN: Record<string, string> = {
  年柱: 'year', 月柱: 'month', 日柱: 'day', 时柱: 'hour',
};

/** 化神 must hold at least this share, or the transformation claims nothing. */
const TRANSFORM_MIN = 30;

/**
 * Above this the old Day Master still has somewhere to stand: 合而不化.
 *
 * Calibrated against the weighting in ./strength rather than picked: a 本气
 * root in the day branch is worth 16 × 0.6 = 9.6 and in the month far more,
 * so this admits only a root out at the year or hour, or a 中气/余气 trace.
 */
const TRANSFORM_ROOT_MAX = 8;

/** 专旺 needs the element to rule, not merely to lead. */
const DOMINANT_MIN = 55;

/** One visible 官杀 stem is already 破格; this bounds the hidden ones too. */
const OFFICER_MAX = 8;

const el = (e: Element) => ELEMENT[e]!.en;
const zh = (e: Element) => ELEMENT[e]!.zh;

/**
 * Decide whether this chart is read by 化气 or by 专旺, in that order.
 *
 * 化气 goes first because it is the more specific claim: it rests on a named
 * stem combination that either is or is not present, while 专旺 rests on
 * weightings that shade into ordinary strength. A chart satisfying both is
 * transformed — the combination is the harder fact of the two.
 *
 * Returns null for the overwhelming majority of charts, which is correct.
 * Between them these two are rarer than 从格.
 */
export function analyzeSpecial(
  chart: Chart,
  elementPercent: Record<Element, number>,
): SpecialStructure | null {
  return transforming(chart, elementPercent) ?? dominant(chart, elementPercent);
}

// ───────────────────────────────────────────────────────────────── 化气格 ──

function transforming(
  chart: Chart,
  elementPercent: Record<Element, number>,
): SpecialStructure | null {
  const combines = findRelations(natalPillars(chart))
    .filter((r) => r.kind === '天干五合');

  // 1. 日干 combines with an adjacent stem. 年柱 is deliberately not adjacent.
  const chosen = combines.find(
    (r) => r.positions.includes('日柱')
      && (r.positions.includes('月柱') || r.positions.includes('时柱')),
  );
  if (!chosen || !chosen.resultElement) return null;

  const target = chosen.resultElement;
  const dmStem = chart.pillars.day.stem;
  const partnerStem = chosen.values.find((v) => v !== dmStem) ?? chosen.values[0]!;
  const partnerPosition = chosen.positions.find((p) => p !== '日柱')!;

  // 2. 月令 must carry the 化神 — the header explains why this reproduces the
  //    classical month tables exactly.
  const monthBranch = chart.pillars.month.branch;
  const inSeason = elementOfBranch(monthBranch) === target
    || TRIPLE_OF[target].includes(monthBranch);
  if (!inSeason) return null;

  // 3. 化神 must have weight.
  const share = elementPercent[target];
  if (share < TRANSFORM_MIN) return null;

  // 4. 争合 — any other 五合 reaching for either partner.
  const contested = combines.some(
    (r) => r !== chosen
      && (r.values.includes(dmStem) || r.values.includes(partnerStem)),
  );
  if (contested) return null;

  // 5. 化神受克. The two partners are bound in the combination, so they do not
  //    count as attackers — otherwise 戊癸化火 could never form at all.
  const attacker = controlledBy(target);
  const bound = new Set(['日柱', partnerPosition]);
  const outsideStems = ([
    ['年柱', chart.pillars.year],
    ['月柱', chart.pillars.month],
    ['时柱', chart.pillars.hour],
  ] as const)
    .filter(([position, p]) => p !== null && !bound.has(position))
    .map(([, p]) => p!.stemElement);
  if (outsideStems.includes(attacker)) return null;

  // 6/7. 日主无根, and there has to be an old self to give up in the first
  //      place — see the header on why the degenerate case is not a 化气格.
  const dm = chart.dayMasterElement;
  if (dm === target) return null;

  // 日坐本气根 — the Day Master sitting on its own element. Rejected on its own
  // rather than through the share below, because the same percentage means
  // something quite different under the Day Master than out at the year.
  const daySeat = chart.pillars.day.hiddenStems.find((h) => h.role === 'main');
  if (daySeat?.element === dm) return null;

  const root = elementPercent[dm];
  if (root > TRANSFORM_ROOT_MAX) return null;

  // 真化 only when the old element is absent from the chart outright. Anything
  // that remains, however light, is what makes a transformation partial.
  const genuine = root === 0;
  const kind = `化${target}格`;
  const feeder = generatedBy(target);
  const favourable: Element[] = [target, feeder];
  const unfavourable: Element[] = [attacker, generates(target), controls(target)]
    .filter((e) => !favourable.includes(e));

  const reasoning: LocalizedText[] = [
    t(
      `日干 ${dmStem} 与${partnerPosition}之 ${partnerStem} 相合，${chosen.label}，` +
        `月支 ${monthBranch} 得${zh(target)}气，${zh(target)}占 ${share.toFixed(1)}%，` +
        `无争合，亦无克化神者，故作${kind}论。`,
      `The day stem ${dmStem} combines with ${partnerStem} in the ` +
        `${POSITION_EN[partnerPosition] ?? partnerPosition} pillar (${chosen.label}). ` +
        `The month branch ${monthBranch} carries ${el(target)}, which holds ` +
        `${share.toFixed(1)}% of the chart, nothing competes for either partner, and ` +
        `nothing visible controls it — so this transforms, as ${kind}.`,
    ),
    genuine
      ? t(
          `日主 ${zh(dm)} 已无根可恃，为真化。`,
          `The Day Master has no ${el(dm)} left to stand on, so this is a true ` +
            `transformation (真化).`,
        )
      : t(
          `日主 ${zh(dm)} 尚存 ${root.toFixed(1)}% 之根，化而未净，作假化论，` +
            `断语强度较真化为轻。`,
          `${root.toFixed(1)}% of ${el(dm)} survives, so the old self is not entirely ` +
            `gone. This stands as a partial transformation (假化) — read with less ` +
            `force than a true one.`,
        ),
    t(
      `化气格取用不以日主论，而以化神论：${zh(target)}为用，${zh(feeder)}生之为喜；` +
        `${zh(attacker)}克化神，为大忌。`,
      `A transformed chart is judged by what it became, never by what it was. ` +
        `${el(target)} is what it wants and ${el(feeder)} feeds it. ${el(attacker)}, ` +
        `which controls ${el(target)}, is the one thing it cannot take.`,
    ),
    t(
      `⚠️ 合化与合而不化仅一线之隔，此判断争议较大，建议人工复核。`,
      `⚠️ A combination that transforms and one that merely binds are a hair apart. ` +
        `This is a contested call — worth a human check.`,
    ),
  ];

  return {
    kind, category: '化气', element: target, genuine,
    favourable, unfavourable, reasoning,
  };
}

// ───────────────────────────────────────────────────────────────── 专旺格 ──

function dominant(
  chart: Chart,
  elementPercent: Record<Element, number>,
): SpecialStructure | null {
  const dm = chart.dayMasterElement;

  // 1. 月令 is the Day Master's own element.
  if (elementOfBranch(chart.pillars.month.branch) !== dm) return null;

  // 2. 支成方局. 土 has neither a triangle nor a season of its own, so 稼穑 is
  //    taken on 支全四库 instead — see the header.
  const branches = [
    chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour,
  ].filter((p) => p !== null).map((p) => p!.branch);

  const has = (trio: readonly string[]) =>
    trio.length > 0 && trio.every((b) => branches.includes(b));
  const gathered = dm === '土'
    ? branches.filter((b) => EARTH_STORES.has(b)).length >= 3
    : has(TRIPLE_OF[dm]) || has(DIRECTIONAL_OF[dm]);
  if (!gathered) return null;

  // 3. 不见官杀. A visible one is 破格 outright; the share bounds the rest.
  const officer = controlledBy(dm);
  const visibleStems = [chart.pillars.year, chart.pillars.month, chart.pillars.hour]
    .filter((p) => p !== null)
    .map((p) => p!.stemElement);
  if (visibleStems.includes(officer)) return null;
  if (elementPercent[officer] > OFFICER_MAX) return null;

  // 4. The element has to actually rule.
  const share = elementPercent[dm];
  if (share < DOMINANT_MIN) return null;

  const kind = DOMINANT_NAME[dm];
  const outlet = generates(dm);
  const feeder = generatedBy(dm);
  const wealth = controls(dm);
  const genuine = elementPercent[officer] === 0;

  const gathering = dm === '土'
    ? t('支全四库', 'the branches hold three or more of the four earth stores')
    : t('支成方局', 'the branches gather into one complete local structure');

  const reasoning: LocalizedText[] = [
    t(
      `月令即日主之${zh(dm)}，${gathering.zh}，${zh(dm)}占 ${share.toFixed(1)}%，` +
        `四柱不见${zh(officer)}官杀相克，一行得气，故作${kind}论。`,
      `The month is the Day Master's own ${el(dm)}, ${gathering.en}, ${el(dm)} holds ` +
        `${share.toFixed(1)}% of the chart, and no ${el(officer)} stands against it. ` +
        `One element has taken the whole chart — this is ${kind}.`,
    ),
    genuine
      ? t(
          `全局不见${zh(officer)}，旺神纯粹，破格之神全无。`,
          `There is no ${el(officer)} anywhere in the chart. The dominant element is ` +
            `unopposed, which makes this a clean case.`,
        )
      : t(
          `${zh(officer)}虽未透干，暗中尚存 ${elementPercent[officer].toFixed(1)}%，` +
            `旺神未至纯粹，断语强度稍减。`,
          `${el(officer)} is hidden rather than absent — ` +
            `${elementPercent[officer].toFixed(1)}% of it remains below the surface, so ` +
            `the structure is a shade less clean and reads with slightly less force.`,
        ),
    t(
      `专旺之局，顺则吉，逆则凶：以${zh(dm)}比劫为用，${zh(outlet)}食伤泄秀为喜，` +
        `${zh(feeder)}印生之；忌${zh(officer)}官杀逆其旺势，亦忌${zh(wealth)}财引群劫相争。`,
      `A chart like this rewards going along with it and punishes standing against it. ` +
        `${el(dm)} itself is what it wants, ${el(outlet)} gives it somewhere to flow, and ` +
        `${el(feeder)} feeds it. ${el(officer)} opposes the whole structure, and ` +
        `${el(wealth)} sets its own peers fighting over the spoils.`,
    ),
  ];

  return {
    kind,
    category: '专旺',
    element: dm,
    genuine,
    favourable: [dm, outlet, feeder],
    unfavourable: [officer, wealth],
    reasoning,
  };
}
