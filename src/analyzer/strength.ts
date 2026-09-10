/**
 * 日主旺衰 — how strong the day master is, and why.
 *
 * This is the single most consequential number in the whole reading: 用神
 * follows from it, and 用神 decides whether a given 十神 reads as help or
 * hindrance. So it is computed, exposed, and explained rather than asserted.
 *
 * WEIGHTING. Positions differ in how much they say about the day master, and
 * the weights below follow the mainstream 子平 ordering: 月令 dominates because
 * 得令 is the strongest single claim on strength, the day branch matters next
 * because the day master sits on it, and the year stem is the most remote.
 * The numbers sum to 100 for a fully-timed chart so the output reads as a
 * percentage rather than an arbitrary index.
 *
 * 人元司令. The month branch is weighted by which of its 藏干 is actually in
 * charge on the day, which depends on how far past the opening 节 the birth
 * falls — see ./siling. Every other branch is weighted by role, since 司令 is
 * a month-branch concept.
 */

import type { Chart, Element, Pillar, PillarPosition } from '../engine/types';
import { t, type LocalizedText } from '../i18n/text';
import { ELEMENT, RELATION, TEN_GOD_FAMILY, YIN_YANG } from '../i18n/glossary';
import {
  ELEMENTS,
  isSupporting,
  tenGodFamily,
  type TenGodFamily,
} from './elements';
import { rulingStem, silingShares, type SiLing } from './siling';
import {
  findRelations, isBranchRelation, natalPillars, RELATION_WEIGHT,
  type RelationKind,
} from './relations';
import { analyzeFollowing, type FollowingAnalysis } from './following';
import { analyzeSpecial, type SpecialStructure } from './special';

/** Weight of each stem position. The day stem is the subject, not evidence. */
const STEM_WEIGHT = { year: 10, month: 12, day: 0, hour: 10 } as const;

/** Weight of each branch position, distributed across its 藏干. */
const BRANCH_WEIGHT = { year: 10, month: 30, day: 16, hour: 12 } as const;

/** Share of a branch's weight taken by each 藏干 role. */
const ROLE_SHARE = { main: 0.6, middle: 0.3, residual: 0.1 } as const;

/** Percentages, not fractions — these are shown to the user verbatim. */
const STRONG_PCT = 55;
const WEAK_PCT = 35;

export type StrengthVerdict = '身强' | '身弱' | '中和';

export interface StrengthAnalysis {
  /** Percentage of total weight held by each element. */
  readonly elementPercent: Record<Element, number>;
  /** Percentage held by each 十神 family, as seen from the day master. */
  readonly familyPercent: Record<TenGodFamily, number>;
  /** 比劫 + 印, the share supporting the day master. The headline number. */
  readonly supportPercent: number;
  readonly verdict: StrengthVerdict;
  /** 得令 — the ruling stem of the month branch supports the day master. */
  readonly hasMonthCommand: boolean;
  /** Who is in charge of the month branch, and on what day count. */
  readonly siLing: SiLing;
  /** 得地 — the day branch's 本气 supports the day master. */
  readonly hasDaySeat: boolean;
  /** 得势 — supporting stems outnumber opposing ones. */
  readonly hasAllies: boolean;
  /** 从格 when the chart genuinely follows, null for every ordinary chart.
   *  Determined rather than flagged — see ./following for the conditions. */
  readonly following: FollowingAnalysis | null;
  /** 化气格 or 专旺格, null for every ordinary chart. Like 从格 it replaces 扶抑
   *  outright rather than modifying it — see ./special. */
  readonly special: SpecialStructure | null;
  /** Every branch whose weight was moved by 刑冲合会, and by how much. Shown,
   *  not hidden — an unexplained discount reads as a bug. */
  readonly relationAdjustments: readonly RelationAdjustment[];
  /** 比劫 + 印 before relations were applied, so the shift is visible. */
  readonly supportPercentBeforeRelations: number;
  /** Reduced confidence when the hour pillar is missing: a quarter of the
   *  evidence is absent, and it is not evenly distributed. */
  readonly confidence: 'normal' | 'reduced-no-hour';
  readonly reasoning: readonly LocalizedText[];
}

interface Contribution {
  element: Element;
  weight: number;
  source: string;
}

/** Position label used by the relation finder, per pillar. */
const RELATION_POSITION: Record<PillarPosition, string> = {
  year: '年柱', month: '月柱', day: '日柱', hour: '时柱',
};

/** The same positions in English, for the reasoning list. */
const POSITION_EN: Record<string, string> = {
  年柱: 'year', 月柱: 'month', 日柱: 'day', 时柱: 'hour',
};

/**
 * How much of its weight a branch keeps once 刑冲合会 are accounted for.
 *
 * A branch does not sit in a chart in isolation. A 月令 that is 冲开 cannot
 * command the way an untouched one does, and a branch tied up in a 合 is
 * committed elsewhere. Reading the weighting without this is the single place
 * this analyzer diverged most from ordinary practice, because 旺衰 decides
 * 用神 and 用神 decides the whole reading.
 *
 * Graded on RELATION_WEIGHT, the same table the 流日 forecast and the joint
 * hour bands already grade on — one definition of what counts as major.
 *
 * 冲 costs more than 合. A 合 does not destroy a branch, it occupies it, so the
 * discount is milder. And note what is deliberately NOT done here: a 合 is
 * never transformed into its 化 element. A real 化 needs the 化神 exposed in a
 * stem and the 月令 behind it; asserting one on thinner evidence would put a
 * fabricated element into the very number the reading rests on.
 */
const CLASH_COST = 0.10;
const COMBINE_COST = 0.05;

/** No branch may lose more than this share of its weight, however many
 *  relations land on it. Relations modulate the weighting; they do not become
 *  it, and a branch buried in minor relations must not vanish. */
const MAX_BRANCH_DISCOUNT = 0.35;

export interface RelationAdjustment {
  readonly position: string;
  readonly branch: string;
  /** Relation labels that acted on this branch, as the Chinese chart writes
   *  them — 亥子丑三会水局. Kept for the Chinese reasoning and the audit trail. */
  readonly relations: readonly string[];
  /** The same relations as kinds, so English prose can name them from the
   *  glossary. Pasting the Chinese label into an English sentence is what the
   *  bilingual guard is there to catch. */
  readonly kinds: readonly RelationKind[];
  /** Multiplier applied to the branch's weight, e.g. 0.8. */
  readonly factor: number;
}

/**
 * Weight kept by each branch after its relations are counted.
 *
 * Returned rather than applied in place so the reasoning list can name every
 * adjustment: a discount the reader cannot see is indistinguishable from a bug.
 */
function branchFactors(chart: Chart): Map<PillarPosition, RelationAdjustment> {
  const relations = findRelations(natalPillars(chart)).filter(isBranchRelation);
  const out = new Map<PillarPosition, RelationAdjustment>();

  const positions: readonly PillarPosition[] = ['year', 'month', 'day', 'hour'];
  for (const position of positions) {
    const pillar = chart.pillars[position];
    if (!pillar) continue;

    const label = RELATION_POSITION[position];
    const hits = relations.filter((r) => r.positions.includes(label));
    if (hits.length === 0) continue;

    let discount = 0;
    for (const r of hits) {
      const grade = RELATION_WEIGHT[r.kind];
      if (grade === 0) continue;
      discount += grade * (r.polarity === 'disturbing' ? CLASH_COST : COMBINE_COST);
    }
    discount = Math.min(discount, MAX_BRANCH_DISCOUNT);
    if (discount === 0) continue;

    out.set(position, {
      position: label,
      branch: pillar.branch,
      relations: hits.map((r) => r.label),
      kinds: hits.map((r) => r.kind),
      factor: 1 - discount,
    });
  }
  return out;
}

function collect(
  chart: Chart,
  siLing: SiLing,
  factors: Map<PillarPosition, RelationAdjustment>,
): Contribution[] {
  const out: Contribution[] = [];
  const monthShares = silingShares(chart.pillars.month.hiddenStems, siLing.stem);
  const pillars: readonly (Pillar | null)[] = [
    chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour,
  ];

  for (const p of pillars) {
    if (!p) continue;

    const stemWeight = STEM_WEIGHT[p.position];
    if (stemWeight > 0) {
      out.push({ element: p.stemElement, weight: stemWeight, source: `${p.position}干 ${p.stem}` });
    }

    // Relations act on branches. A stem clash is real but it does not reach
    // into the branch, which is where the day master's rooting is measured.
    const factor = factors.get(p.position)?.factor ?? 1;
    const branchWeight = BRANCH_WEIGHT[p.position] * factor;
    for (const h of p.hiddenStems) {
      // 司令 governs the month branch only; elsewhere role is the right proxy.
      const share = p.position === 'month'
        ? monthShares.get(h.stem) ?? ROLE_SHARE[h.role]
        : ROLE_SHARE[h.role];
      out.push({
        element: h.element,
        weight: branchWeight * share,
        source: `${p.position}支 ${p.branch} 藏 ${h.stem}`,
      });
    }
  }
  return out;
}

export function analyzeStrength(chart: Chart): StrengthAnalysis {
  const siLing = rulingStem(
    chart.pillars.month.branch,
    chart.monthTermDays,
    chart.pillars.month.hiddenStems,
  );
  const adjustments = branchFactors(chart);
  const contributions = collect(chart, siLing, adjustments);
  const total = contributions.reduce((s, c) => s + c.weight, 0);

  const elementRaw = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  for (const c of contributions) elementRaw[c.element] += c.weight;

  const elementPercent = roundToHundred(
    Object.fromEntries(
      ELEMENTS.map((e) => [e, (elementRaw[e] / total) * 100]),
    ) as Record<Element, number>,
  );

  const dm = chart.dayMasterElement;
  const familyPercent: Record<TenGodFamily, number> = {
    比劫: 0, 印: 0, 食伤: 0, 财: 0, 官杀: 0,
  };
  // Summed from the ALREADY-ROUNDED element figures, so the two breakdowns
  // agree with each other and both total exactly 100.
  for (const e of ELEMENTS) {
    familyPercent[tenGodFamily(dm, e)] += elementPercent[e];
  }
  for (const k of Object.keys(familyPercent) as TenGodFamily[]) {
    familyPercent[k] = round1(familyPercent[k]);
  }

  const supportPercent = round1(familyPercent['比劫'] + familyPercent['印']);

  // The same sum with every branch at full weight. Computed so the reasoning
  // can state what the relations actually moved, rather than asserting that
  // they were considered.
  const supportPercentBeforeRelations = (() => {
    if (adjustments.size === 0) return supportPercent;
    const plain = collect(chart, siLing, new Map());
    const plainTotal = plain.reduce((s, c) => s + c.weight, 0);
    let support = 0;
    for (const c of plain) {
      if (isSupporting(tenGodFamily(dm, c.element))) support += c.weight;
    }
    return round1((support / plainTotal) * 100);
  })();

  const monthRuler = chart.pillars.month.hiddenStems.find((h) => h.stem === siLing.stem);
  const dayMain = chart.pillars.day.hiddenStems.find((h) => h.role === 'main');
  // 得令 asks whether the stem in charge supports the day master, which is not
  // always the 本气 — that was the old approximation.
  const hasMonthCommand = !!monthRuler && isSupporting(tenGodFamily(dm, monthRuler.element));
  const hasDaySeat = !!dayMain && isSupporting(tenGodFamily(dm, dayMain.element));

  const supportingStems = [chart.pillars.year, chart.pillars.month, chart.pillars.hour]
    .filter((p): p is Pillar => p !== null)
    .filter((p) => isSupporting(tenGodFamily(dm, p.stemElement))).length;
  const hasAllies = supportingStems >= 2;

  const verdict: StrengthVerdict =
    supportPercent >= STRONG_PCT ? '身强'
    : supportPercent <= WEAK_PCT ? '身弱'
    : '中和';

  // 化气 and 专旺 are settled first, and 从格 only if neither fired. All three
  // replace 扶抑, so at most one may hold — and 化气 outranks 从格 on the charts
  // where both conditions happen to be met, because a named stem combination is
  // a harder fact than a weighting near a threshold. 专旺 cannot collide with
  // 从格 at all: one needs the month to feed the Day Master and the other needs
  // it not to.
  const special = analyzeSpecial(chart, elementPercent);

  // 从格 is decided here, not merely suspected. The conditions live in
  // ./following because they are a different judgement from 扶抑, not a
  // variation on it — see that module for why each one is required.
  const following = special ? null : analyzeFollowing(
    chart,
    familyPercent,
    hasMonthCommand,
    monthRuler ? tenGodFamily(dm, monthRuler.element) : null,
  );

  const el = (e: Element) => ELEMENT[e]!;
  const fam = (f: TenGodFamily) => TEN_GOD_FAMILY[f]!;
  const dmName = `${chart.dayMaster}`;

  const reasoning: LocalizedText[] = [
    t(
      `日主 ${dmName}（${dm}）。支持力量 比劫 ${familyPercent['比劫']}% + ` +
        `印 ${familyPercent['印']}% = ${supportPercent}%。`,
      `Day Master ${dmName} (${YIN_YANG[chart.dayMasterYinYang]!.en} ${el(dm).en}). ` +
        `Support: ${fam('比劫').en} ${familyPercent['比劫']}% + ` +
        `${fam('印').en} ${familyPercent['印']}% = ${supportPercent}%.`,
    ),
    t(
      `耗泄力量 食伤 ${familyPercent['食伤']}% + 财 ${familyPercent['财']}% + ` +
        `官杀 ${familyPercent['官杀']}% = ${round1(100 - supportPercent)}%。`,
      `Drain: ${fam('食伤').en} ${familyPercent['食伤']}% + ` +
        `${fam('财').en} ${familyPercent['财']}% + ` +
        `${fam('官杀').en} ${familyPercent['官杀']}% = ${round1(100 - supportPercent)}%.`,
    ),
    t(
      `月支 ${chart.pillars.month.branch}：生日距节 ${siLing.daysIntoTerm.toFixed(1)} 天，` +
        `${siLing.stem}司令` +
        (siLing.substituted ? `（分野本作${siLing.classicalStem}，非本支所藏，故以本气代之）` : '') +
        '。',
      `Month branch ${chart.pillars.month.branch}: born ` +
        `${siLing.daysIntoTerm.toFixed(1)} days after the opening term, so ` +
        `${siLing.stem} is in charge` +
        (siLing.substituted
          ? ` (the classical table names ${siLing.classicalStem} here, which this ` +
            `branch does not hold, so its 本气 stands in)`
          : '') + '.',
    ),
    hasMonthCommand
      ? t(
          `得令：司令之${siLing.stem}生扶日主，此为判强的主因。`,
          `In season: ${siLing.stem}, the stem in charge, feeds the Day Master. ` +
            `This is the single strongest claim on strength.`,
        )
      : t(
          `失令：司令之${siLing.stem}不生扶日主，此为判弱的主因。`,
          `Out of season: ${siLing.stem}, the stem in charge, does not feed the ` +
            `Day Master. This is the main reason it reads weak.`,
        ),
    hasDaySeat
      ? t(
          `得地：日支 ${chart.pillars.day.branch} 为日主根气。`,
          `Rooted: the day branch ${chart.pillars.day.branch} gives the Day Master ` +
            `something to stand on.`,
        )
      : t(
          `不得地：日支 ${chart.pillars.day.branch} 未为日主根气。`,
          `Unrooted: the day branch ${chart.pillars.day.branch} gives the Day Master ` +
            `no root of its own.`,
        ),
    hasAllies
      ? t('得势：天干有帮身之神。', 'Allied: supporting stems are present above.')
      : t('失势：天干帮身之神不足。', 'Unallied: too few supporting stems above.'),
    t(
      `判定 ${verdict}（阈值 身强≥${STRONG_PCT}%，身弱≤${WEAK_PCT}%）。`,
      `Verdict: ${verdict === '身强' ? 'strong' : verdict === '身弱' ? 'weak' : 'balanced'} ` +
        `(thresholds: strong ≥${STRONG_PCT}%, weak ≤${WEAK_PCT}%).`,
    ),
  ];

  // Named before the verdict is justified, because a discount the reader cannot
  // see is indistinguishable from a bug in the number above it.
  for (const a of adjustments.values()) {
    const pct = Math.round((1 - a.factor) * 100);
    // English names the relation KIND from the glossary; the Chinese label
    // (亥子丑三会水局) is chart notation and does not belong in English prose.
    // English names only. The guard in test/bilingual.test.ts treats 会 as a
    // Chinese function word, so 三会 cannot ride along in parentheses — and the
    // auditable characters, the branches themselves, are already in the line.
    const kindsEn = [...new Set(a.kinds)]
      .map((k) => RELATION[k]?.en ?? k)
      .join(', ');
    reasoning.splice(reasoning.length - 1, 0, t(
      `${a.position} ${a.branch} 逢${a.relations.join('、')}，力量按 ${pct}% 折减。`,
      `The ${POSITION_EN[a.position] ?? a.position} branch ${a.branch} is caught by ` +
        `${kindsEn}, so its weight is discounted by ${pct}%.`,
    ));
  }
  if (adjustments.size > 0 && supportPercentBeforeRelations !== supportPercent) {
    reasoning.splice(reasoning.length - 1, 0, t(
      `刑冲合会计入后，帮身由 ${supportPercentBeforeRelations}% 变为 ${supportPercent}%。`,
      `With those relations counted, support moves from ` +
        `${supportPercentBeforeRelations}% to ${supportPercent}%.`,
    ));
  }

  if (special) reasoning.push(...special.reasoning);
  if (following) reasoning.push(...following.reasoning);

  if (!chart.hourKnown) {
    reasoning.push(t(
      '⚠️ 时柱未知，约四分之一的判断依据缺失，旺衰结论的可信度降低。',
      '⚠️ The hour is unknown, so roughly a quarter of the evidence is missing and ' +
        'this strength verdict is correspondingly less certain.',
    ));
  }

  return {
    elementPercent,
    familyPercent,
    supportPercent,
    verdict,
    hasMonthCommand,
    siLing,
    hasDaySeat,
    hasAllies,
    following,
    special,
    relationAdjustments: [...adjustments.values()],
    supportPercentBeforeRelations,
    confidence: chart.hourKnown ? 'normal' : 'reduced-no-hour',
    reasoning,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Round a percentage breakdown to one decimal place so that it still sums to
 * exactly 100.
 *
 * Rounding each share independently leaves a breakdown reading 99.9%, which
 * looks like a bug to anyone who adds the column up. Largest-remainder
 * apportionment gives the leftover tenths to the entries that lost the most in
 * rounding, which is both fair and stable for a given input.
 */
function roundToHundred(raw: Record<Element, number>): Record<Element, number> {
  const scaled = ELEMENTS.map((e) => ({ e, exact: raw[e] * 10 }));
  const floored = scaled.map((s) => ({ ...s, floor: Math.floor(s.exact) }));
  const deficit = 1000 - floored.reduce((sum, s) => sum + s.floor, 0);

  const order = [...floored].sort(
    (a, b) => (b.exact - b.floor) - (a.exact - a.floor),
  );
  const bonus = new Set(order.slice(0, Math.max(0, deficit)).map((s) => s.e));

  return Object.fromEntries(
    floored.map((s) => [s.e, (s.floor + (bonus.has(s.e) ? 1 : 0)) / 10]),
  ) as Record<Element, number>;
}
