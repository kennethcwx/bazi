/**
 * 五行 primitives: the generate and control cycles, and the six-way relation a
 * day master has to any other element.
 *
 * Everything in L2 reduces to these two cycles, so they live alone in one file
 * with no dependencies.
 */

import type { Element, TenGod } from '../engine/types';

export const ELEMENTS: readonly Element[] = ['木', '火', '土', '金', '水'];

/** 相生: each element generates the next. */
const GENERATES: Record<Element, Element> = {
  木: '火', 火: '土', 土: '金', 金: '水', 水: '木',
};

/** 相克: each element controls the one two steps along. */
const CONTROLS: Record<Element, Element> = {
  木: '土', 土: '水', 水: '火', 火: '金', 金: '木',
};

export const generates = (e: Element): Element => GENERATES[e];
export const controls = (e: Element): Element => CONTROLS[e];
/** 生我者为印 */
export const generatedBy = (e: Element): Element =>
  ELEMENTS.find((x) => GENERATES[x] === e)!;
/** 克我者为官杀 */
export const controlledBy = (e: Element): Element =>
  ELEMENTS.find((x) => CONTROLS[x] === e)!;

/**
 * The five 十神 families, as seen from a day master.
 *
 * 比劫 and 印 support the day master; 食伤, 财 and 官杀 spend or oppose it.
 * This split is the basis of 旺衰 scoring.
 */
export type TenGodFamily = '比劫' | '印' | '食伤' | '财' | '官杀';

export function tenGodFamily(dayMaster: Element, other: Element): TenGodFamily {
  if (other === dayMaster) return '比劫';
  if (generates(other) === dayMaster) return '印';
  if (generates(dayMaster) === other) return '食伤';
  if (controls(dayMaster) === other) return '财';
  return '官杀';
}

/** Whether a family reinforces the day master (同类) or spends it (异类). */
export const isSupporting = (f: TenGodFamily): boolean => f === '比劫' || f === '印';

/** The family a specific 十神 belongs to. */
export const FAMILY_OF: Record<TenGod, TenGodFamily> = {
  比肩: '比劫', 劫财: '比劫',
  正印: '印',   偏印: '印',
  食神: '食伤', 伤官: '食伤',
  正财: '财',   偏财: '财',
  正官: '官杀', 七杀: '官杀',
};

/**
 * The element a 十神 family maps to, seen from a day master.
 *
 * Inverse of {@link tenGodFamily}: given "what does 财 mean for a 木 day
 * master", answer 土. Used wherever a family-level judgement (用神, 配偶星)
 * has to be compared against a concrete element.
 */
export function familyElement(dayMaster: Element, family: TenGodFamily): Element {
  switch (family) {
    case '比劫': return dayMaster;
    case '印': return generatedBy(dayMaster);
    case '食伤': return generates(dayMaster);
    case '财': return controls(dayMaster);
    case '官杀': return controlledBy(dayMaster);
  }
}

/**
 * 天干 / 地支 to 五行.
 *
 * The engine already attaches elements to natal pillars, but luck pillars
 * (大运, 流年) arrive as bare 干支 strings, so the analyzer needs its own
 * lookup rather than reaching back into tyme4ts.
 */
const STEM_ELEMENT: Record<string, Element> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

const BRANCH_ELEMENT: Record<string, Element> = {
  寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金',
  亥: '水', 子: '水', 辰: '土', 戌: '土', 丑: '土', 未: '土',
};

export function elementOfStem(stem: string): Element {
  const e = STEM_ELEMENT[stem];
  if (!e) throw new Error(`Unknown heavenly stem "${stem}"`);
  return e;
}

export function elementOfBranch(branch: string): Element {
  const e = BRANCH_ELEMENT[branch];
  if (!e) throw new Error(`Unknown earthly branch "${branch}"`);
  return e;
}
