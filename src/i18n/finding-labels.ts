/**
 * Human names for finding ids.
 *
 * The citation line under each section of a reading is the product's core
 * claim: you can see what a statement rests on. But it was rendering the raw
 * ids — "依据：rel.palace.content, rel.star.exposed" — which is developer
 * output, not an explanation. A reader learns nothing from a snake-case key.
 *
 * These are deliberately short. The citation is a pointer to the finding, not
 * a restatement of it; the finding itself sits a little further down the page.
 */

import { t, type LocalizedText, type Locale } from './text';

export const FINDING_LABELS: Record<string, LocalizedText> = {
  // 姻缘
  'rel.palace.content': t('夫妻宫所坐', 'what sits in the Spouse Palace'),
  'rel.star.absent': t('命中不见配偶星', 'no spouse star in the chart'),
  'rel.star.hidden': t('配偶星藏而不透', 'spouse star hidden, not visible'),
  'rel.star.exposed': t('配偶星透干', 'spouse star showing openly'),
  'rel.star.favourable': t('配偶星为用神', 'the spouse star helps this chart'),
  'rel.star.unfavourable': t('配偶星非用神', 'the spouse star costs this chart'),
  'rel.palace.disturbed': t('夫妻宫受刑冲', 'the Spouse Palace is disturbed'),
  'rel.palace.stable': t('夫妻宫安稳', 'the Spouse Palace is undisturbed'),
  'rel.male.competition': t('比劫夺财', 'rivals competing for the wife star'),
  'rel.female.mixed': t('官杀混杂', 'both husband stars present'),
  'rel.female.hurting-officer': t('伤官见官', 'self-expression against authority'),
  'rel.shensha': t('感情神煞', 'symbolic stars for relationships'),
  'rel.timing.favourable': t('婚缘引动的年份', 'years that stir the marriage palace'),
  'rel.timing.volatile': t('感情变动的年份', 'years of change in the relationship'),
  'rel.no-hour': t('出生时辰未知', 'birth hour unknown'),

  // 事业
  'career.structure': t('月令格局', 'the structure taken from the month'),
  'career.lean': t('受雇或自营', 'employment or working for yourself'),
  'career.industry': t('用神与行业', 'favourable element and sectors'),
  'career.dominant': t('十神偏向', 'the dominant force in the chart'),
  'career.timing.favourable': t('得力的大运', 'the strongest luck pillars'),
  'career.timing.mild': t('较顺的大运', 'the more workable luck pillars'),
  'career.timing.none': t('无明显旺运', 'no clearly strong pillar'),
  'career.timing.adverse': t('须留意的大运', 'luck pillars to be careful in'),
  'career.shensha': t('事业神煞', 'symbolic stars for work'),

  // 合婚
  'compat.supply': t('两人用神互补', 'what each chart supplies the other'),
  'compat.day.harmony': t('两人日柱相合', 'the two day pillars harmonise'),
  'compat.day.clash': t('两人日柱相犯', 'the two day pillars clash'),
  'compat.day.neutral': t('两人日柱无涉', 'the two day pillars do not engage'),
  'compat.spouse-star': t('日主为对方配偶星', 'one Day Master is the other spouse star'),
  'compat.zodiac': t('生肖相合冲', 'zodiac signs'),
  'compat.gap': t('最缺的五行', 'the element you are shortest of'),
  'compat.no-hour': t('出生时辰未知', 'birth hour unknown'),
};

/**
 * Name a finding for display, falling back to the id.
 *
 * The fallback is visible on purpose: a new finding without a label should look
 * wrong in review rather than silently render as a blank chip.
 */
export function findingLabel(id: string, locale: Locale): string {
  return FINDING_LABELS[id]?.[locale] ?? id;
}
