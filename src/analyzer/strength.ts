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
 * KNOWN SIMPLIFICATION. A stricter engine weights the month branch's hidden
 * stems by 人元司令 — which hidden stem "rules" depends on how many days into
 * the solar term the birth falls. We weight by role (本气/中气/余气) instead,
 * which is the common simplification and is stable, but it will differ from a
 * 司令-aware tool for births early or late in a term. Flagged rather than
 * hidden, because a practitioner will notice.
 */

import type { Chart, Element, Pillar } from '../engine/types';
import {
  ELEMENTS,
  isSupporting,
  tenGodFamily,
  type TenGodFamily,
} from './elements';

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
  /** 得令 — the month branch's 本气 supports the day master. */
  readonly hasMonthCommand: boolean;
  /** 得地 — the day branch's 本气 supports the day master. */
  readonly hasDaySeat: boolean;
  /** 得势 — supporting stems outnumber opposing ones. */
  readonly hasAllies: boolean;
  /** Set when support is so scarce that a 从格 reading is plausible. */
  readonly followingCandidate: TenGodFamily | null;
  /** Reduced confidence when the hour pillar is missing: a quarter of the
   *  evidence is absent, and it is not evenly distributed. */
  readonly confidence: 'normal' | 'reduced-no-hour';
  readonly reasoning: readonly string[];
}

interface Contribution {
  element: Element;
  weight: number;
  source: string;
}

function collect(chart: Chart): Contribution[] {
  const out: Contribution[] = [];
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
      out.push({
        element: h.element,
        weight: branchWeight * ROLE_SHARE[h.role],
        source: `${p.position}支 ${p.branch} 藏 ${h.stem}`,
      });
    }
  }
  return out;
}

export function analyzeStrength(chart: Chart): StrengthAnalysis {
  const contributions = collect(chart);
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

  const monthMain = chart.pillars.month.hiddenStems.find((h) => h.role === 'main');
  const dayMain = chart.pillars.day.hiddenStems.find((h) => h.role === 'main');
  const hasMonthCommand = !!monthMain && isSupporting(tenGodFamily(dm, monthMain.element));
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

  const reasoning: string[] = [
    `日主 ${chart.dayMaster}（${dm}）。支持力量 比劫 ${familyPercent['比劫']}% + ` +
      `印 ${familyPercent['印']}% = ${supportPercent}%。`,
    `耗泄力量 食伤 ${familyPercent['食伤']}% + 财 ${familyPercent['财']}% + ` +
      `官杀 ${familyPercent['官杀']}% = ${round1(100 - supportPercent)}%。`,
    hasMonthCommand
      ? `得令：月支 ${chart.pillars.month.branch} 本气${monthMain?.stem ?? ''}生扶日主。`
      : `失令：月支 ${chart.pillars.month.branch} 本气不生扶日主，此为判弱的主因。`,
    hasDaySeat
      ? `得地：日支 ${chart.pillars.day.branch} 为日主根气。`
      : `不得地：日支 ${chart.pillars.day.branch} 未为日主根气。`,
    hasAllies ? '得势：天干有帮身之神。' : '失势：天干帮身之神不足。',
    `判定 ${verdict}（阈值 身强≥${STRONG_PCT}%，身弱≤${WEAK_PCT}%）。`,
  ];

  if (followingCandidate) {
    reasoning.push(
      `⚠️ 日主无根且${followingCandidate}极旺，可能成从格。从格与扶抑取用神相反，` +
        `此判断有争议，建议人工复核。`,
    );
  }

  if (!chart.hourKnown) {
    reasoning.push('⚠️ 时柱未知，约四分之一的判断依据缺失，旺衰结论的可信度降低。');
  }

  return {
    elementPercent,
    familyPercent,
    supportPercent,
    verdict,
    hasMonthCommand,
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
