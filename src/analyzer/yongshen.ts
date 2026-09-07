/**
 * 用神 / 忌神 — the elements that help the day master, and those that hurt it.
 *
 * THIS IS THE CONTESTED PART OF THE WHOLE SYSTEM. 扶抑 (support/suppress),
 * 调候 (climate), 通关 (mediation) and the 新派 格局 school genuinely disagree,
 * and a user's own 师傅 may well have told them something different. So this
 * module does three things deliberately:
 *
 *   1. Commits to ONE school — 扶抑 primary, 调候 as modifier — because a
 *      reading that hedges is useless.
 *   2. Labels that school in its output, so a disagreement reads as "different
 *      method" rather than "your app is broken".
 *   3. Reports when 扶抑 and 调候 point at different elements instead of
 *      silently resolving it, because that conflict is real information.
 *
 * The selection rules below are deterministic. That is the point: the same
 * chart must always produce the same 用神, or nothing downstream is reproducible.
 */

import type { Chart, Element } from '../engine/types';
import { t, type LocalizedText } from '../i18n/text';
import { ELEMENT, TEN_GOD_FAMILY } from '../i18n/glossary';
import {
  ELEMENTS,
  familyElement,
  tenGodFamily,
  type TenGodFamily,
} from './elements';
import type { StrengthAnalysis } from './strength';

export const SCHOOL: LocalizedText = t(
  '扶抑为主，调候为辅（子平主流）',
  'Strength-based (扶抑) with climate (调候) as a modifier — the mainstream Ziping method',
);

/** A family must hold at least this share to be usable as 用神. Below it the
 *  element is too weak to lean on and we fall through to the next choice. */
const USABLE_SHARE = 10;

/** 冬月 need warmth, 夏月 need cooling. The classic 调候 pairs. */
const WINTER_BRANCHES = new Set(['亥', '子', '丑']);
const SUMMER_BRANCHES = new Set(['巳', '午', '未']);

export interface YongShenAnalysis {
  /** Always present, always shown to the user. */
  readonly school: LocalizedText;
  /** 用神 — the single element the chart most needs. */
  readonly primary: Element;
  /** 喜神 — supporting cast; helps the 用神 do its work. */
  readonly secondary: Element | null;
  /** 用神 + 喜神. */
  readonly favourable: readonly Element[];
  /** 忌神 — elements that worsen the imbalance. */
  readonly unfavourable: readonly Element[];
  /** The family the 用神 belongs to, as seen from the day master. */
  readonly primaryFamily: TenGodFamily;
  /** 调候用神, when the birth month is extreme. */
  readonly climateNeed: Element | null;
  /** True when 调候 wants something 扶抑 considers unfavourable. Surfaced, not
   *  resolved — it is a real disagreement between two valid readings. */
  readonly climateConflict: boolean;
  readonly reasoning: readonly LocalizedText[];
}

export function analyzeYongShen(
  chart: Chart,
  strength: StrengthAnalysis,
): YongShenAnalysis {
  const dm = chart.dayMasterElement;
  const share = strength.familyPercent;
  const reasoning: LocalizedText[] = [];
  const el = (e: Element) => ELEMENT[e]!.en;
  const fam = (f: TenGodFamily) => TEN_GOD_FAMILY[f]!.en;

  // 从格 is not a modifier on 扶抑 — it replaces it. A chart that has given up
  // its own side is read by feeding the dominant force, so returning early here
  // is the point rather than a shortcut.
  if (strength.following) {
    const f = strength.following;
    const favourable = f.favourable.map((fam2) => familyElement(dm, fam2));
    const unfavourable = f.unfavourable.map((fam2) => familyElement(dm, fam2));
    return {
      school: t(
        `从格（${f.kind}），不以扶抑论`,
        `Following structure (${f.kind}) — not read by the ordinary strength method`,
      ),
      primary: favourable[0]!,
      secondary: favourable[1] ?? null,
      favourable,
      unfavourable,
      primaryFamily: f.favourable[0]!,
      climateNeed: null,
      climateConflict: false,
      reasoning: [
        ...f.reasoning,
        t(
          `故用神 ${favourable.map((e) => ELEMENT[e]!.zh).join('、')}，` +
            `忌神 ${unfavourable.map((e) => ELEMENT[e]!.zh).join('、')}。`,
          `So the chart wants ${favourable.map(el).join(' and ')}, and works against ` +
            `${unfavourable.map(el).join(', ')}.`,
        ),
      ],
    };
  }

  let primaryFamily: TenGodFamily;
  let secondaryFamily: TenGodFamily | null;

  if (strength.verdict === '身强') {
    // Strong day master: spend it. Prefer direct control, then consumption,
    // then output — 官杀 acts fastest, but only if there is enough of it to act.
    if (share['官杀'] >= USABLE_SHARE) {
      primaryFamily = '官杀';
      secondaryFamily = '财';
      reasoning.push(t(
        `身强，官杀 ${share['官杀']}% 有力，取官杀克身为用，财为喜（财生官）。`,
        `The Day Master is strong and ${fam('官杀')} is substantial at ${share['官杀']}%, ` +
          `so authority is what this chart should spend itself on. Wealth supports it.`,
      ));
    } else if (share['财'] >= USABLE_SHARE) {
      primaryFamily = '财';
      secondaryFamily = '食伤';
      reasoning.push(t(
        `身强而官杀不足，财 ${share['财']}% 可耗身，取财为用，食伤为喜（食伤生财）。`,
        `The Day Master is strong but authority is thin, so wealth at ${share['财']}% ` +
          `is what draws the excess off. Output feeds it.`,
      ));
    } else {
      primaryFamily = '食伤';
      secondaryFamily = '财';
      reasoning.push(t(
        '身强而官杀、财俱轻，取食伤泄秀为用，财为喜。',
        'The Day Master is strong and both authority and wealth are light, so ' +
          'output — expression and making things — is the healthiest outlet. Wealth supports it.',
      ));
    }
  } else if (strength.verdict === '身弱') {
    // Weak day master: reinforce it. 印 both feeds the day master and absorbs
    // 官杀, so it is preferred when present; otherwise lean on peers.
    if (share['印'] >= USABLE_SHARE) {
      primaryFamily = '印';
      secondaryFamily = '比劫';
      reasoning.push(t(
        `身弱，印 ${share['印']}% 可生身且化官杀，取印为用，比劫为喜。`,
        `The Day Master is weak. Resource at ${share['印']}% both feeds it and absorbs ` +
          `pressure from authority, so that is what it needs. Peers help too.`,
      ));
    } else {
      primaryFamily = '比劫';
      secondaryFamily = '印';
      reasoning.push(t(
        '身弱而印不足，取比劫帮身为用，印为喜。',
        'The Day Master is weak and resource is thin, so peers — allies and ' +
          'self-reliance — are what shore it up. Resource supports that.',
      ));
    }
  } else {
    // Balanced: no side needs propping, so supply what the chart lacks. This
    // is the 补不足 principle rather than 扶抑 proper.
    const scarcest = [...ELEMENTS].sort(
      (a, b) => strength.elementPercent[a] - strength.elementPercent[b],
    )[0]!;
    primaryFamily = tenGodFamily(dm, scarcest);
    secondaryFamily = null;
    reasoning.push(t(
      `中和之局，无须扶抑，取最弱的 ${scarcest}（${strength.elementPercent[scarcest]}%）` +
        `补不足为用。`,
      `The chart is balanced, so neither propping up nor draining is called for. ` +
        `The scarcest element, ${el(scarcest)} at ${strength.elementPercent[scarcest]}%, ` +
        `is what it lacks.`,
    ));
  }

  const primary = familyElement(dm, primaryFamily);
  const secondary = secondaryFamily ? familyElement(dm, secondaryFamily) : null;

  // 调候: an extreme birth month needs tempering regardless of strength.
  const monthBranch = chart.pillars.month.branch;
  let climateNeed: Element | null = null;
  if (WINTER_BRANCHES.has(monthBranch)) {
    climateNeed = '火';
    reasoning.push(t(
      `生于 ${monthBranch} 月，天寒，调候喜火暖局。`,
      `Born in the ${monthBranch} month, the chart is cold. On climate grounds it ` +
        `wants Fire to warm it.`,
    ));
  } else if (SUMMER_BRANCHES.has(monthBranch)) {
    climateNeed = '水';
    reasoning.push(t(
      `生于 ${monthBranch} 月，火炎，调候喜水润局。`,
      `Born in the ${monthBranch} month, the chart runs hot. On climate grounds it ` +
        `wants Water to temper it.`,
    ));
  }

  const favourable: Element[] = [primary];
  if (secondary && secondary !== primary) favourable.push(secondary);

  const unfavourable = ELEMENTS.filter((e) => !favourable.includes(e));

  let climateConflict = false;
  if (climateNeed) {
    if (favourable.includes(climateNeed)) {
      reasoning.push(t(
        `调候与扶抑一致，${climateNeed} 为用甚验。`,
        `Climate and strength agree — ${el(climateNeed)} on both counts, which makes ` +
          `it an unusually reliable read.`,
      ));
    } else {
      climateConflict = true;
      reasoning.push(t(
        `⚠️ 调候取 ${climateNeed}，扶抑取 ${primary}，两者不一致。` +
          `本盘以扶抑为主，但 ${climateNeed} 运仍有暖局/润局之功，` +
          `此处不同流派会有不同结论。`,
        `⚠️ Climate wants ${el(climateNeed)}; strength wants ${el(primary)}. They ` +
          `disagree. This reading follows strength, but ${el(climateNeed)} periods ` +
          `still do real tempering work — and a different school would reach a ` +
          `different answer here.`,
      ));
    }
  }

  reasoning.push(t(
    `用神 ${primary}（${primaryFamily}）` +
      `${secondary ? `，喜神 ${secondary}` : ''}，忌神 ${unfavourable.join('、')}。`,
    `Favourable: ${el(primary)} (${fam(primaryFamily)})` +
      `${secondary ? `, supported by ${el(secondary)}` : ''}. ` +
      `Unfavourable: ${unfavourable.map(el).join(', ')}.`,
  ));

  return {
    school: SCHOOL,
    primary,
    secondary,
    favourable,
    unfavourable,
    primaryFamily,
    climateNeed,
    climateConflict,
    reasoning,
  };
}
