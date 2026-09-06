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

import type { Chart, Element, Pillar } from '../engine/types';
import { t, type LocalizedText } from '../i18n/text';
import { ELEMENT, TEN_GOD_FAMILY, YIN_YANG } from '../i18n/glossary';
import {
  ELEMENTS,
  isSupporting,
  tenGodFamily,
  type TenGodFamily,
} from './elements';
import { rulingStem, silingShares, type SiLing } from './siling';

/** Weight of each stem position. The day stem is the subject, not evidence. */
const STEM_WEIGHT = { year: 10, month: 12, day: 0, hour: 10 } as const;

/** Weight of each branch position, distributed across its 藏干. */
const BRANCH_WEIGHT = { year: 10, month: 30, day: 16, hour: 12 } as const;

/** Share of a branch's weight taken by each 藏干 role. */
const ROLE_SHARE = { main: 0.6, middle: 0.3, residual: 0.1 } as const;

/** Below this share of total weight, a 从格 (following structure) is worth
 *  raising as a candidate — never asserted, because 从格 is contested. */
const FOLLOWING_THRESHOLD = 0.12;

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
  /** Set when support is so scarce that a 从格 reading is plausible. */
  readonly followingCandidate: TenGodFamily | null;
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

function collect(chart: Chart, siLing: SiLing): Contribution[] {
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

    const branchWeight = BRANCH_WEIGHT[p.position];
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
  const contributions = collect(chart, siLing);
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

  // 从格: the day master has almost nothing to stand on and one opposing
  // family overwhelms the chart. Raised as a candidate for a human to judge.
  let followingCandidate: TenGodFamily | null = null;
  if (supportPercent < FOLLOWING_THRESHOLD * 100 && !hasMonthCommand) {
    const dominant = (Object.entries(familyPercent) as [TenGodFamily, number][])
      .filter(([f]) => !isSupporting(f))
      .sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] >= 40) followingCandidate = dominant[0];
  }

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

  if (followingCandidate) {
    reasoning.push(t(
      `⚠️ 日主无根且${followingCandidate}极旺，可能成从格。从格与扶抑取用神相反，` +
        `此判断有争议，建议人工复核。`,
      `⚠️ The Day Master has almost no root and ${fam(followingCandidate).en} ` +
        `overwhelms the chart, so a "following" (从格) reading is possible. That ` +
        `reading inverts the favourable element entirely. It is contested — worth ` +
        `a human check.`,
    ));
  }

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
    followingCandidate,
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
