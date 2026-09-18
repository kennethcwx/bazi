/**
 * 调候用神表 — the classical climate table from 《穷通宝鉴》 as summarised by
 * 徐乐吾, 10 day stems × 12 month branches. Each cell is a string of stems:
 * the first is the 调候用神 proper, the rest are the supporting stems in the
 * order the text names them.
 *
 * This is a lookup, not a model. The text reasons stem by stem (甲 in 午 wants
 * 癸 to cool it AND 庚 to prune it), so the answer is a stem rather than an
 * element — 丙 and 丁 are both Fire but the table never treats them alike.
 * Callers that only need an element take the first stem's element.
 */

const MONTHS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'] as const;

const TABLE: Record<string, readonly string[]> = {
  //     寅      卯      辰      巳      午      未      申      酉      戌      亥      子      丑
  甲: ['丙癸', '庚丙', '庚丁壬', '癸庚丁', '癸庚丁', '癸庚丁', '庚丁壬', '庚丁丙', '庚甲丁壬癸', '庚丁戊丙', '丁庚丙', '丁庚丙'],
  乙: ['丙癸', '丙癸', '癸丙戊', '癸', '癸丙', '癸丙', '丙癸己', '癸丙丁', '癸辛', '丙戊', '丙', '丙'],
  丙: ['壬庚', '壬己', '壬甲', '壬庚癸', '壬庚', '壬庚', '壬戊', '壬癸', '甲壬', '甲戊庚壬', '壬戊己', '壬甲'],
  丁: ['甲庚', '庚甲', '甲庚', '甲庚', '壬庚癸', '甲壬庚', '甲庚丙戊', '甲庚丙戊', '甲庚戊', '甲庚', '甲庚', '甲庚'],
  戊: ['丙甲癸', '丙甲癸', '甲丙癸', '甲丙癸', '壬甲丙', '癸丙甲', '丙癸甲', '丙癸', '甲丙癸', '甲丙', '丙甲', '丙甲'],
  己: ['丙庚甲', '甲癸丙', '丙癸甲', '癸丙', '癸丙', '癸丙', '丙癸', '丙癸', '甲丙癸', '丙甲戊', '丙甲戊', '丙甲戊'],
  庚: ['戊甲壬丙丁', '丁甲庚丙', '甲丁壬癸', '壬戊丙丁', '壬癸', '丁甲', '丁甲', '丁甲丙', '甲壬', '丁丙', '丁甲丙', '丙丁甲'],
  辛: ['己壬庚', '壬甲', '壬甲', '壬甲癸', '壬己癸', '壬庚甲', '壬甲戊', '壬甲', '壬甲', '壬丙', '丙戊壬甲', '丙壬戊己'],
  壬: ['庚丙戊', '戊辛庚', '甲庚', '壬辛庚癸', '癸庚辛', '辛甲', '戊丁', '甲庚', '甲丙', '戊丙庚', '戊丙', '丙丁甲'],
  癸: ['辛丙', '庚辛', '丙辛甲', '辛', '庚辛壬癸', '庚辛壬癸', '丁', '辛丙', '辛甲壬癸', '庚辛戊丁', '丙辛', '丙丁'],
};

/** 调候 stems for a day stem born in a month branch, 用神 first. */
export function tiaoHouStems(dayStem: string, monthBranch: string): readonly string[] {
  const row = TABLE[dayStem];
  const col = MONTHS.indexOf(monthBranch as (typeof MONTHS)[number]);
  if (!row || col < 0) throw new Error(`No 调候 entry for ${dayStem} in ${monthBranch}`);
  return [...row[col]!];
}
