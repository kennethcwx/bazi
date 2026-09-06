/**
 * The term glossary — canonical Chinese in, readable English out.
 *
 * Keyed on the Chinese term because that is what the engine emits and what a
 * practitioner will check against. The English is the standard rendering used
 * in English-language BaZi writing (正财 → "Direct Wealth", 七杀 → "Seven
 * Killings"), not a literal gloss, so an English reader lands on the term they
 * will meet everywhere else.
 *
 * Some things are deliberately NOT translated:
 *
 *  - 干支 characters themselves (甲, 子, 甲子). They are the chart. Rendering
 *    them as "Yang Wood over Rat" turns a chart into a description of a chart,
 *    and any practitioner reading over the user's shoulder loses their footing.
 *  - 纳音 names (海中金 "Gold in the Sea"). These are poetic labels; the
 *    English is supplied for flavour but the Chinese stays alongside.
 */

import { t, type LocalizedText, type Locale } from './text';

// ---------------------------------------------------------------------------
// 五行 · Five Elements

export const ELEMENT: Record<string, LocalizedText> = {
  木: t('木', 'Wood'),
  火: t('火', 'Fire'),
  土: t('土', 'Earth'),
  金: t('金', 'Metal'),
  水: t('水', 'Water'),
};

export const YIN_YANG: Record<string, LocalizedText> = {
  阴: t('阴', 'Yin'),
  阳: t('阳', 'Yang'),
};

// ---------------------------------------------------------------------------
// 十神 · Ten Gods

export const TEN_GOD: Record<string, LocalizedText> = {
  比肩: t('比肩', 'Companion'),
  劫财: t('劫财', 'Rob Wealth'),
  食神: t('食神', 'Eating God'),
  伤官: t('伤官', 'Hurting Officer'),
  偏财: t('偏财', 'Indirect Wealth'),
  正财: t('正财', 'Direct Wealth'),
  七杀: t('七杀', 'Seven Killings'),
  正官: t('正官', 'Direct Officer'),
  偏印: t('偏印', 'Indirect Resource'),
  正印: t('正印', 'Direct Resource'),
};

/** One line on what each 十神 actually means, for first use. */
export const TEN_GOD_GLOSS: Record<string, LocalizedText> = {
  比肩: t('同我者，主同侪与自立', 'peers and self-reliance'),
  劫财: t('同我而异性，主竞争与分夺', 'rivalry and shared claims'),
  食神: t('我生者，主表达与享受', 'expression, ease, output'),
  伤官: t('我生而异性，主才华与不受拘束', 'talent that resists being managed'),
  偏财: t('我克而同性，主流动之财与机会', 'opportunistic, moving money'),
  正财: t('我克而异性，主稳定之财与配偶（男命）', 'steady earned money; the wife star for a man'),
  七杀: t('克我而同性，主压力与魄力', 'pressure, drive, hard authority'),
  正官: t('克我而异性，主责任与名分（女命夫星）', 'duty and standing; the husband star for a woman'),
  偏印: t('生我而同性，主偏门学问与思虑', 'unconventional learning, overthinking'),
  正印: t('生我而异性，主学养与庇护', 'education, credentials, protection'),
};

export const TEN_GOD_FAMILY: Record<string, LocalizedText> = {
  比劫: t('比劫', 'Peers'),
  印: t('印', 'Resource'),
  食伤: t('食伤', 'Output'),
  财: t('财', 'Wealth'),
  官杀: t('官杀', 'Authority'),
};

// ---------------------------------------------------------------------------
// 十二长生 · Twelve Stages

export const TERRAIN: Record<string, LocalizedText> = {
  长生: t('长生', 'Growth'),
  沐浴: t('沐浴', 'Bathing'),
  冠带: t('冠带', 'Coming of Age'),
  临官: t('临官', 'Taking Office'),
  帝旺: t('帝旺', 'Peak'),
  衰: t('衰', 'Waning'),
  病: t('病', 'Illness'),
  死: t('死', 'Death'),
  墓: t('墓', 'Tomb'),
  绝: t('绝', 'Extinction'),
  胎: t('胎', 'Conception'),
  养: t('养', 'Nurture'),
};

// ---------------------------------------------------------------------------
// 神煞 · Symbolic Stars

export const SHENSHA: Record<string, LocalizedText> = {
  桃花: t('桃花', 'Peach Blossom'),
  红鸾: t('红鸾', 'Red Phoenix'),
  天喜: t('天喜', 'Heavenly Joy'),
  红艳: t('红艳', 'Red Beauty'),
  孤辰: t('孤辰', 'Solitary Star'),
  寡宿: t('寡宿', 'Widow Star'),
  阴差阳错: t('阴差阳错', 'Mismatched Pillar'),
  将星: t('将星', 'General Star'),
  驿马: t('驿马', 'Travelling Horse'),
};

// ---------------------------------------------------------------------------
// 干支关系 · Relations

export const RELATION: Record<string, LocalizedText> = {
  天干五合: t('天干五合', 'Stem Combination'),
  天干相冲: t('天干相冲', 'Stem Clash'),
  六合: t('六合', 'Six Harmony'),
  三合: t('三合', 'Three Harmony'),
  半合: t('半合', 'Half Harmony'),
  三会: t('三会', 'Directional Union'),
  六冲: t('六冲', 'Clash'),
  相刑: t('相刑', 'Punishment'),
  自刑: t('自刑', 'Self-punishment'),
  相害: t('相害', 'Harm'),
  相破: t('相破', 'Destruction'),
};

// ---------------------------------------------------------------------------
// Structural terms

export const TERM: Record<string, LocalizedText> = {
  日主: t('日主', 'Day Master'),
  日元: t('日元', 'Day Master'),
  夫妻宫: t('夫妻宫', 'Spouse Palace'),
  年柱: t('年柱', 'Year'),
  月柱: t('月柱', 'Month'),
  日柱: t('日柱', 'Day'),
  时柱: t('时柱', 'Hour'),
  年支: t('年支', 'year branch'),
  月支: t('月支', 'month branch'),
  日支: t('日支', 'day branch'),
  时支: t('时支', 'hour branch'),
  日干: t('日干', 'day stem'),
  藏干: t('藏干', 'Hidden Stems'),
  纳音: t('纳音', 'Nayin'),
  旬空: t('旬空', 'Void'),
  空亡: t('空亡', 'Void'),
  大运: t('大运', 'Luck Pillar'),
  流年: t('流年', 'Annual Luck'),
  用神: t('用神', 'Favourable Element'),
  喜神: t('喜神', 'Supporting Element'),
  忌神: t('忌神', 'Unfavourable Elements'),
  身强: t('身强', 'Strong Day Master'),
  身弱: t('身弱', 'Weak Day Master'),
  中和: t('中和', 'Balanced'),
  得令: t('得令', 'in season'),
  失令: t('失令', 'out of season'),
  格局: t('格局', 'Structure'),
  配偶星: t('配偶星', 'Spouse Star'),
  真太阳时: t('真太阳时', 'true solar time'),
};

/** 格局 names, built from the 十神 that forms them. */
export const STRUCTURE: Record<string, LocalizedText> = {
  建禄格: t('建禄格', 'Prosperity Structure'),
  羊刃格: t('羊刃格', 'Yang Blade Structure'),
  正财格: t('正财格', 'Direct Wealth Structure'),
  偏财格: t('偏财格', 'Indirect Wealth Structure'),
  正官格: t('正官格', 'Direct Officer Structure'),
  七杀格: t('七杀格', 'Seven Killings Structure'),
  正印格: t('正印格', 'Direct Resource Structure'),
  偏印格: t('偏印格', 'Indirect Resource Structure'),
  食神格: t('食神格', 'Eating God Structure'),
  伤官格: t('伤官格', 'Hurting Officer Structure'),
};

export const DIRECTION: Record<string, LocalizedText> = {
  东方: t('东方', 'east'),
  南方: t('南方', 'south'),
  西方: t('西方', 'west'),
  北方: t('北方', 'north'),
  中部与本地: t('中部与本地', 'central regions and close to home'),
};

export const DECADE_VERDICT: Record<string, LocalizedText> = {
  有利: t('有利', 'Strong'),
  偏顺: t('偏顺', 'Fair'),
  平稳: t('平稳', 'Steady'),
  不利: t('不利', 'Difficult'),
};

export const HIDDEN_ROLE: Record<string, LocalizedText> = {
  main: t('本气', 'primary'),
  middle: t('中气', 'secondary'),
  residual: t('余气', 'residual'),
};

// ---------------------------------------------------------------------------

const TABLES: readonly Record<string, LocalizedText>[] = [
  ELEMENT, YIN_YANG, TEN_GOD, TEN_GOD_FAMILY, TERRAIN,
  SHENSHA, RELATION, TERM, STRUCTURE, DIRECTION, DECADE_VERDICT,
];

/**
 * Look a term up across every table.
 *
 * Falls back to the term itself, which is the right behaviour for anything
 * that is genuinely untranslatable — a 干支 pair, a 纳音 name — and means a
 * missing entry degrades to Chinese rather than to a blank or a crash.
 */
export function term(chinese: string, locale: Locale): string {
  if (locale === 'zh') return chinese;
  for (const table of TABLES) {
    const hit = table[chinese];
    if (hit) return hit.en;
  }
  return chinese;
}

/**
 * A term with its counterpart in brackets, for first use in prose.
 * In Chinese this is just the term; in English it keeps the characters
 * visible so the reader can carry them to any other source.
 */
export function termWithOriginal(chinese: string, locale: Locale): string {
  if (locale === 'zh') return chinese;
  const en = term(chinese, 'en');
  return en === chinese ? chinese : `${en} (${chinese})`;
}

/** The one-line explanation of a 十神, for teaching on first use. */
export function tenGodGloss(tenGod: string, locale: Locale): string {
  return TEN_GOD_GLOSS[tenGod]?.[locale] ?? '';
}
