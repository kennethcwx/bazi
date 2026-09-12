/**
 * 流月 — the twelve months of a 流年, read on the decade scale.
 *
 * A month is the layer between the year and the day: 大运 sets a decade,
 * 流年 a year, 流月 the month inside it. It is read exactly as a decade is —
 * the element base against 用神 / 忌神 / 闲神, then 合冲 with the natal chart
 * — because the same 冲 on the same palace means the same thing whichever
 * layer brings it; only the span differs. Reusing the decade scorer is the
 * point: a month strip that scored on its own rules would disagree with the
 * decade row above it for no reason a reader could follow.
 *
 * No 旬空 here: void is a property of a pillar against the day pillar's
 * decade, and the classical practice applies it to 大运, not to months.
 */

import { monthlyLuck } from '../../engine/chart';
import type { Chart, MonthlyLuck } from '../../engine/types';
import type { LocalizedText } from '../../i18n/text';
import type { YongShenAnalysis } from '../yongshen';
import { scoreElementBase, scoreLuckRelations, verdictOf, type DecadeVerdict } from './career';

export interface MonthOutlook extends MonthlyLuck {
  readonly score: number;
  readonly verdict: DecadeVerdict;
  readonly notes: readonly LocalizedText[];
}

export function scoreMonths(
  chart: Chart,
  yongShen: Pick<YongShenAnalysis, 'favourable' | 'unfavourable'>,
  year: number,
): MonthOutlook[] {
  const fav = new Set(yongShen.favourable);
  return monthlyLuck(chart, year).map((m) => {
    const base = scoreElementBase(m.stem, m.branch, yongShen, '');
    const rel = scoreLuckRelations(chart, m.stem, m.branch, fav, '流月');
    const score = base.score + rel.delta;
    return {
      ...m,
      score,
      verdict: verdictOf(score),
      notes: [...base.notes, ...rel.notes],
    };
  });
}
