/**
 * L2 entry point: Chart -> Findings.
 *
 * Order matters and is not incidental. 旺衰 must be settled before 用神,
 * because 用神 is chosen relative to strength; and 用神 must be settled before
 * either topic, because whether a 十神 reads as help or hindrance depends
 * entirely on it. Everything below is a pure function of the chart.
 */

import type { Chart } from '../engine/types';
import { analyzeStrength, type StrengthAnalysis } from './strength';
import { analyzeYongShen, type YongShenAnalysis } from './yongshen';
import { analyzeRelationship, type RelationshipAnalysis } from './topics/relationship';
import { analyzeCareer, type CareerAnalysis } from './topics/career';
import { applicable, type Finding, type Topic } from './findings';

/**
 * Bump whenever a change to L2 alters the findings a chart produces.
 *
 * A reading is cached on the chart hash, and `chartHash` covers L1 only — the
 * charted moment, gender and conventions. Change the analyzer without changing
 * this and a warm instance keeps serving prose grounded in findings that no
 * longer exist, while the UI renders the new ones beside it. Citations that do
 * not match their evidence is the one failure this product cannot absorb.
 *
 * v2: 旺衰 counts 刑冲合会; 格局 taken by 月令人元透干; 阴干 no longer 羊刃格.
 * v3: 从格 determined rather than flagged, and 用神 inverts when it is.
 * v4: 大运 decades scored on 合冲 with the natal chart, not element match alone.
 * v5: 神煞 expanded — 天乙贵人, 文昌, 禄神, 金舆, 羊刃, 华盖, 魁罡.
 * v6: 建禄/羊刃/月劫 named from the 月令 directly (禄刃 are month-command
 *     patterns), so a 透 财官 no longer mislabels a 建禄 chart.
 * v7: 化气格 and 专旺格 determined, and 用神 inverts when either is — the last
 *     two structures that replace 扶抑 rather than modifying it.
 */
export const ANALYZER_VERSION = 'v7';

export interface Analysis {
  readonly chart: Chart;
  readonly strength: StrengthAnalysis;
  readonly yongShen: YongShenAnalysis;
  readonly relationship: RelationshipAnalysis;
  readonly career: CareerAnalysis;
  /** Every finding, hour-dependent ones already removed if the hour is unknown. */
  readonly findings: readonly Finding[];
}

export function analyzeChart(chart: Chart): Analysis {
  const strength = analyzeStrength(chart);
  const yongShen = analyzeYongShen(chart, strength);
  const relationship = analyzeRelationship(chart, strength, yongShen);
  const career = analyzeCareer(chart, strength, yongShen);

  const findings = applicable(
    [...relationship.findings, ...career.findings],
    chart.hourKnown,
  );

  return { chart, strength, yongShen, relationship, career, findings };
}

/** Findings for one topic, most salient first — what a narrator template gets. */
export function findingsFor(analysis: Analysis, topic: Topic): Finding[] {
  return analysis.findings
    .filter((f) => f.topic === topic)
    .sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0));
}

export * from './findings';
export * from './elements';
export { analyzeStrength, analyzeYongShen, analyzeRelationship, analyzeCareer };
export type { StrengthAnalysis, YongShenAnalysis, RelationshipAnalysis, CareerAnalysis };
