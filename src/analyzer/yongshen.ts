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
import {
  ELEMENTS,
  familyElement,
  tenGodFamily,
  type TenGodFamily,
} from './elements';
import type { StrengthAnalysis } from './strength';

export const SCHOOL = '扶抑为主，调候为辅（子平主流）';

/** A family must hold at least this share to be usable as 用神. Below it the
 *  element is too weak to lean on and we fall through to the next choice. */
const USABLE_SHARE = 10;

/** 冬月 need warmth, 夏月 need cooling. The classic 调候 pairs. */
const WINTER_BRANCHES = new Set(['亥', '子', '丑']);
const SUMMER_BRANCHES = new Set(['巳', '午', '未']);

export interface YongShenAnalysis {
  /** Always present, always shown to the user. */
  readonly school: string;
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
  readonly reasoning: readonly string[];
}

export function analyzeYongShen(
  chart: Chart,
  strength: StrengthAnalysis,
): YongShenAnalysis {
  const dm = chart.dayMasterElement;
  const share = strength.familyPercent;
  const reasoning: string[] = [];

  let primaryFamily: TenGodFamily;
  let secondaryFamily: TenGodFamily | null;

  if (strength.verdict === '身强') {
    // Strong day master: spend it. Prefer direct control, then consumption,
    // then output — 官杀 acts fastest, but only if there is enough of it to act.
    if (share['官杀'] >= USABLE_SHARE) {
      primaryFamily = '官杀';
      secondaryFamily = '财';
      reasoning.push(`身强，官杀 ${share['官杀']}% 有力，取官杀克身为用，财为喜（财生官）。`);
    } else if (share['财'] >= USABLE_SHARE) {
      primaryFamily = '财';
      secondaryFamily = '食伤';
      reasoning.push(`身强而官杀不足，财 ${share['财']}% 可耗身，取财为用，食伤为喜（食伤生财）。`);
    } else {
      primaryFamily = '食伤';
      secondaryFamily = '财';
      reasoning.push(`身强而官杀、财俱轻，取食伤泄秀为用，财为喜。`);
    }
  } else if (strength.verdict === '身弱') {
    // Weak day master: reinforce it. 印 both feeds the day master and absorbs
    // 官杀, so it is preferred when present; otherwise lean on peers.
    if (share['印'] >= USABLE_SHARE) {
      primaryFamily = '印';
      secondaryFamily = '比劫';
      reasoning.push(`身弱，印 ${share['印']}% 可生身且化官杀，取印为用，比劫为喜。`);
    } else {
      primaryFamily = '比劫';
      secondaryFamily = '印';
      reasoning.push(`身弱而印不足，取比劫帮身为用，印为喜。`);
    }
  } else {
    // Balanced: no side needs propping, so supply what the chart lacks. This
    // is the 补不足 principle rather than 扶抑 proper.
    const scarcest = [...ELEMENTS].sort(
      (a, b) => strength.elementPercent[a] - strength.elementPercent[b],
    )[0]!;
    primaryFamily = tenGodFamily(dm, scarcest);
    secondaryFamily = null;
    reasoning.push(
      `中和之局，无须扶抑，取最弱的 ${scarcest}（${strength.elementPercent[scarcest]}%）` +
        `补不足为用。`,
    );
  }

  const primary = familyElement(dm, primaryFamily);
  const secondary = secondaryFamily ? familyElement(dm, secondaryFamily) : null;

  // 调候: an extreme birth month needs tempering regardless of strength.
  const monthBranch = chart.pillars.month.branch;
  let climateNeed: Element | null = null;
  if (WINTER_BRANCHES.has(monthBranch)) {
    climateNeed = '火';
    reasoning.push(`生于 ${monthBranch} 月，天寒，调候喜火暖局。`);
  } else if (SUMMER_BRANCHES.has(monthBranch)) {
    climateNeed = '水';
    reasoning.push(`生于 ${monthBranch} 月，火炎，调候喜水润局。`);
  }

  const favourable: Element[] = [primary];
  if (secondary && secondary !== primary) favourable.push(secondary);

  const unfavourable = ELEMENTS.filter((e) => !favourable.includes(e));

  let climateConflict = false;
  if (climateNeed) {
    if (favourable.includes(climateNeed)) {
      reasoning.push(`调候与扶抑一致，${climateNeed} 为用甚验。`);
    } else {
      climateConflict = true;
      reasoning.push(
        `⚠️ 调候取 ${climateNeed}，扶抑取 ${primary}，两者不一致。` +
          `本盘以扶抑为主，但 ${climateNeed} 运仍有暖局/润局之功，` +
          `此处不同流派会有不同结论。`,
      );
    }
  }

  if (strength.followingCandidate) {
    reasoning.push(
      `⚠️ 旺衰分析提示可能成从格。若作从格论，用神与上述完全相反` +
        `（从${strength.followingCandidate}则以${strength.followingCandidate}为用）。` +
        `本盘按正格扶抑取用。`,
    );
  }

  reasoning.push(
    `用神 ${primary}（${primaryFamily}）` +
      `${secondary ? `，喜神 ${secondary}` : ''}，忌神 ${unfavourable.join('、')}。`,
  );

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
