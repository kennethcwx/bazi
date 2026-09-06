/**
 * The Finding — the unit of everything L2 produces and L3 is allowed to say.
 *
 * A finding is a single claim plus the chart facts that support it. The
 * narrator receives a list of these and may assert nothing outside them; the
 * grounding test walks generated prose back to finding ids. That is what makes
 * a reading auditable when a user says their 师傅 disagreed.
 *
 * Claims and evidence are bilingual pairs rather than strings. Both languages
 * are authored at the point the finding is made, because the English is not a
 * translation — 「日支坐正财而透干」 is complete for a Chinese reader and opaque
 * rendered literally, so the English says what it means.
 */

import type { LocalizedText, Locale } from '../i18n/text';

export type Topic = 'base' | 'relationship' | 'career';

export interface Finding {
  /** Stable identifier. Prompts and the grounding check key on this, so it
   *  must not change once a reading has been cached against it. */
  readonly id: string;
  readonly topic: Topic;
  /** The claim itself, stated plainly, in both languages. */
  readonly claim: LocalizedText;
  /** The chart facts it rests on — 「日支坐正财而透干」 rather than a vibe. */
  readonly evidence: readonly LocalizedText[];
  /**
   * high   — a direct structural reading with wide agreement between schools
   * medium — a standard reading that depends on a judgement call upstream
   * low    — contested, or resting on a pillar we are not certain of
   */
  readonly confidence: 'high' | 'medium' | 'low';
  /** True when the finding depends on the hour pillar. Suppressed entirely
   *  when the birth time is unknown rather than quietly weakened. */
  readonly requiresHour: boolean;
  /** Optional weighting for ordering findings in a report. */
  readonly salience?: number;
}

export function finding(f: Finding): Finding {
  return f;
}

/** Drop hour-dependent findings when there is no hour pillar. */
export function applicable(
  findings: readonly Finding[],
  hourKnown: boolean,
): Finding[] {
  return findings.filter((f) => hourKnown || !f.requiresHour);
}

/** A finding flattened to one language, for the UI and the API. */
export interface RenderedFinding {
  readonly id: string;
  readonly topic: Topic;
  readonly claim: string;
  readonly evidence: readonly string[];
  readonly confidence: Finding['confidence'];
  readonly requiresHour: boolean;
  readonly salience?: number;
}

export function renderFinding(f: Finding, locale: Locale): RenderedFinding {
  return {
    id: f.id,
    topic: f.topic,
    claim: f.claim[locale],
    evidence: f.evidence.map((e) => e[locale]),
    confidence: f.confidence,
    requiresHour: f.requiresHour,
    ...(f.salience === undefined ? {} : { salience: f.salience }),
  };
}
