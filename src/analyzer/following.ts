/**
 * 从格 — the charts that are judged by surrender rather than by balance.
 *
 * WHY THIS IS DETERMINED AND NOT MERELY FLAGGED. Until now the analyzer raised
 * 从格 as a possibility and left it there, with a note saying the favourable
 * element might invert. That is the wrong shape: mainstream 子平 treats 从格 as
 * an ordinary named verdict with stated entry conditions, not as an open
 * question, and a caveat that fires on a few percent of charts to say "this
 * might mean the opposite" is not something a reader can act on. So it is
 * decided here, under conditions strict enough that a wrong call is rare, and
 * labelled 真从 or 假从 so the confidence travels with it.
 *
 * THE CONDITIONS, and they are conjunctive — a chart that misses any one of
 * them is an ordinary chart read by 扶抑:
 *
 *   1. 日主失令 — the stem in command of the month does not feed the day master.
 *   2. 月令 IS the followed family. 从财 wants a 财 month, 从杀 an 官杀 month,
 *      从儿 a 食伤 month. Following a force the season does not carry is not 从.
 *   3. 透干 — the followed family shows in a visible stem. An entirely hidden
 *      force cannot be surrendered to; the classical texts are explicit that
 *      without 透干 the 格 does not form.
 *   4. The followed force is not under attack: 从财 must not meet 比劫,
 *      从官杀 must not meet 食伤, 从儿 must not meet 印. One of those breaks it
 *      (破格) — the chart is then fighting, which is the opposite of following.
 *   5. 日主无根. This is the hinge, and it is where 阳干 and 阴干 part company.
 *
 * 阳干 vs 阴干. 甲丙戊庚壬 do not abandon themselves: any real 比劫 or 印
 * support at all and the chart is not 从, not even partially. 乙丁己辛癸 will
 * yield with a trace of support still present, which is 假从 — genuine enough
 * to read as 从, weak enough that it is named as the lesser case. This is the
 * same 阳/阴 asymmetry that governs 羊刃, and it falls out of the same idea:
 * the yang stems are rigid, the yin stems are pliant.
 *
 * 从儿 is the exception to the root rule. The output is the day master's own
 * child, so a little root does not break the surrender the way it breaks 从财
 * or 从杀 — it only has to be too little to stand on.
 *
 * WHAT IT CHANGES. In a 从格 the 用神 inverts: you feed the dominant force and
 * 比劫/印 become 忌神. That inversion is the whole reason this matters, and the
 * reason a wrong call is expensive rather than merely imprecise.
 */

import type { Chart } from '../engine/types';
import { t, type LocalizedText } from '../i18n/text';
import { TEN_GOD_FAMILY } from '../i18n/glossary';
import { tenGodFamily, type TenGodFamily } from './elements';

export type FollowingKind = '从财格' | '从杀格' | '从官格' | '从儿格';

/** The family each 从格 surrenders to. */
const FOLLOWED_FAMILY: Record<FollowingKind, TenGodFamily> = {
  从财格: '财', 从杀格: '官杀', 从官格: '官杀', 从儿格: '食伤',
};

/** What breaks each one — the 十神 family that attacks the followed force. */
const BREAKER: Record<TenGodFamily, TenGodFamily | null> = {
  财: '比劫',      // 比劫 rob 财
  官杀: '食伤',    // 食伤 fight 官杀
  食伤: '印',      // 印 smother 食伤
  比劫: null,
  印: null,
};

/** A dominant family must hold at least this share before 从 is considered. */
const DOMINANT_MIN = 40;

/**
 * Support at or below this is "no root" for a 阳干. Not literally zero: the
 * weighting counts residual 藏干 at a tenth of a branch, so a trace reading of
 * a percent or two is noise rather than something to stand on.
 */
const YANG_ROOT_MAX = 3;

/** 阴干 yield with a trace of help still present — that trace is 假从. */
const YIN_ROOT_MAX = 10;

/** 从儿 tolerates a root, so long as it is too little to stand on. */
const CHILD_ROOT_MAX = 15;

export interface FollowingAnalysis {
  readonly kind: FollowingKind;
  readonly family: TenGodFamily;
  /** 真从 when nothing at all supports the day master; 假从 when a trace does. */
  readonly genuine: boolean;
  /** 用神 families, strongest first. */
  readonly favourable: readonly TenGodFamily[];
  readonly unfavourable: readonly TenGodFamily[];
  readonly reasoning: readonly LocalizedText[];
}

/** 用神 by 格, from the classical 喜忌: feed the force, never oppose it. */
const FAVOUR: Record<TenGodFamily, { yes: TenGodFamily[]; no: TenGodFamily[] }> = {
  // 从财: 财 is the用, 食伤 generates it, 官杀 drains what little self remains.
  财: { yes: ['财', '食伤'], no: ['比劫', '印'] },
  // 从杀: 官杀 is the 用, 财 feeds it. 食伤 fight it; 比劫印 rebuild the self.
  官杀: { yes: ['官杀', '财'], no: ['食伤', '比劫', '印'] },
  // 从儿: 食伤 is the 用 and 财 carries it onward. 印 smothers, 官杀 obstruct.
  食伤: { yes: ['食伤', '财'], no: ['印', '官杀'] },
  比劫: { yes: [], no: [] },
  印: { yes: [], no: [] },
};

/**
 * Decide whether this chart follows, and what it follows.
 *
 * Returns null for every ordinary chart — which is the overwhelming majority,
 * and should be. 从格 is rare in practice and a model that finds it often is
 * miscalibrated, not perceptive.
 */
export function analyzeFollowing(
  chart: Chart,
  familyPercent: Record<TenGodFamily, number>,
  hasMonthCommand: boolean,
  monthRulerFamily: TenGodFamily | null,
): FollowingAnalysis | null {
  // 1. 失令. A day master the season feeds is never 从.
  if (hasMonthCommand) return null;

  const support = familyPercent['比劫'] + familyPercent['印'];
  const isYang = chart.dayMasterYinYang === '阳';

  // The strongest force that is not the day master's own side.
  const dominant = (['财', '官杀', '食伤'] as const)
    .map((f) => [f, familyPercent[f]] as const)
    .sort((a, b) => b[1] - a[1])[0];
  if (!dominant || dominant[1] < DOMINANT_MIN) return null;
  const family = dominant[0];

  // 2. 月令 must carry the followed force.
  if (monthRulerFamily !== family) return null;

  // 3. 透干 — visible in a stem. The 日干 is the subject, not evidence.
  const dm = chart.dayMasterElement;
  const visible = [
    chart.pillars.year, chart.pillars.month, chart.pillars.hour,
  ].filter((p) => p !== null);
  const exposed = visible.some((p) => tenGodFamily(dm, p!.stemElement) === family);
  if (!exposed) return null;

  // 4. 破格 — the followed force must not be under attack from a visible stem.
  const breaker = BREAKER[family];
  if (breaker && visible.some((p) => tenGodFamily(dm, p!.stemElement) === breaker)) {
    return null;
  }

  // 5. 无根, with the 阳/阴 split and the 从儿 exception.
  const rootCeiling = family === '食伤'
    ? CHILD_ROOT_MAX
    : (isYang ? YANG_ROOT_MAX : YIN_ROOT_MAX);
  if (support > rootCeiling) return null;

  // 真从 only when nothing at all props the day master up. A yang stem that
  // reaches here already has effectively none; a yin stem may be carrying the
  // trace that makes this 假从.
  const genuine = support <= YANG_ROOT_MAX;

  const kind: FollowingKind =
    family === '财' ? '从财格'
    : family === '食伤' ? '从儿格'
    : monthRulerIsSeven(chart) ? '从杀格' : '从官格';

  const fam = (f: TenGodFamily) => TEN_GOD_FAMILY[f]!;
  const reasoning: LocalizedText[] = [
    t(
      `日主失令，帮身仅 ${support.toFixed(1)}%，而${family}占 ${dominant[1].toFixed(1)}%，` +
        `月令亦为${family}且透干，无食伤/比劫/印破格，故作${kind}论。`,
      `The Day Master is out of season with only ${support.toFixed(1)}% support, while ` +
        `${fam(family).en} holds ${dominant[1].toFixed(1)}%. The month commands that same ` +
        `force, it is exposed in a stem, and nothing visible attacks it — so this is read ` +
        `as ${kind}.`,
    ),
    genuine
      ? t(
          `日主全然无根，为真从。`,
          `The Day Master has no root at all, so this is a true following (真从).`,
        )
      : family === '食伤'
        ? t(
            `日主尚存 ${support.toFixed(1)}% 之根，然食伤当令而旺，从儿不忌微根，` +
              `作假从论，断语强度较真从为轻。`,
            `A root of ${support.toFixed(1)}% remains, but the output star commands the ` +
              `month. 从儿 does not require a rootless Day Master, so this stands as a ` +
              `partial following (假从) — read with less force than a true one.`,
          )
        : t(
            `日主尚存一点${support.toFixed(1)}% 之助，阴干可舍命相从，作假从论，` +
              `断语强度较真从为轻。`,
            `A trace of support remains (${support.toFixed(1)}%). A yin Day Master will ` +
              `still yield on that, so this is a partial following (假从) — read with ` +
              `less force than a true one.`,
          ),
    t(
      `从格取用与正格相反：顺其旺势，以${FAVOUR[family].yes.join('、')}为用，` +
        `${FAVOUR[family].no.join('、')}为忌。`,
      `A following chart inverts the ordinary reading: go with the dominant force. ` +
        `${FAVOUR[family].yes.map((f) => fam(f).en).join(' and ')} are what it wants; ` +
        `${FAVOUR[family].no.map((f) => fam(f).en).join(', ')} work against it.`,
    ),
  ];

  if (!genuine && family !== '食伤') {
    reasoning.push(t(
      `⚠️ 假从与身弱用印仅一线之隔，此判断争议较大，建议人工复核。`,
      `⚠️ A partial following and an ordinary weak chart wanting 印 are a hair apart. ` +
        `This call is the most contested one this analyzer makes — worth a human check.`,
    ));
  }

  return {
    kind,
    family,
    genuine,
    favourable: FAVOUR[family].yes,
    unfavourable: FAVOUR[family].no,
    reasoning,
  };
}

/** 七杀 or 正官 in command — only the name of the 格 turns on it. */
function monthRulerIsSeven(chart: Chart): boolean {
  const main = chart.pillars.month.hiddenStems.find((h) => h.role === 'main');
  return main?.tenGod === '七杀';
}
