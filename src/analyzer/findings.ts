/**
 * The Finding — the unit of everything L2 produces and L3 is allowed to say.
 *
 * A finding is a single claim plus the chart facts that support it. The
 * narrator receives a list of these and may assert nothing outside them; the
 * grounding test walks generated prose back to finding ids. That is what makes
 * a reading auditable when a user says their 师傅 disagreed.
 */

export type Topic = 'base' | 'relationship' | 'career';

export interface Finding {
  /** Stable identifier. Prompts and the grounding check key on this, so it
   *  must not change once a reading has been cached against it. */
  readonly id: string;
  readonly topic: Topic;
  /** The claim itself, stated plainly. */
  readonly claim: string;
  /** The chart facts it rests on — 「日支坐正财而透干」 rather than a vibe. */
  readonly evidence: readonly string[];
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
