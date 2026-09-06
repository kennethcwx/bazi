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
