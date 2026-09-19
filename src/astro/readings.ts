/**
 * Natal-chart prose, composed rather than looked up.
 *
 * Sun, Moon and Ascendant get a sentence per sign — the 36 lines everyone
 * asks about first. The other planets are read as "what the planet does"
 * through "the house it does it in", which covers 8 × 12 placements with 20
 * lines of copy instead of 96. ponytail: composed planet-in-house lines; add
 * per-placement copy if a reader finds them samey.
 */

import { t, type LocalizedText } from '../i18n/text';
import { PLANETS, SIGNS, type AspectKind, type NatalChart, type PlanetKey } from './natal';

const SUN: readonly LocalizedText[] = [
  t('太阳白羊：直接、急切，靠开始新事物来认识自己。', 'Sun in Aries: direct and impatient, you know yourself by starting things.'),
  t('太阳金牛：求稳、求实，节奏慢但很难被推倒。', 'Sun in Taurus: steady and practical, slow to move and hard to topple.'),
  t('太阳双子：好奇、善言，靠交换想法保持活力。', 'Sun in Gemini: curious and articulate, kept alive by trading ideas.'),
  t('太阳巨蟹：重感情、护短，安全感来自归属。', 'Sun in Cancer: feeling-led and protective, secure when you belong somewhere.'),
  t('太阳狮子：需要被看见，慷慨而有主张。', 'Sun in Leo: needs to be seen, generous and opinionated.'),
  t('太阳处女：讲究、务实，用改进细节来表达关心。', 'Sun in Virgo: exacting and useful, care shown by fixing details.'),
  t('太阳天秤：重关系与公平，决定前先看对方。', 'Sun in Libra: relationship-minded and fair, weighs the other side before deciding.'),
  t('太阳天蝎：深、专注、不轻易信任，一旦投入就彻底。', 'Sun in Scorpio: intense and private, slow to trust and total once committed.'),
  t('太阳射手：向外、乐观，需要意义和空间。', 'Sun in Sagittarius: outward and optimistic, needs meaning and room.'),
  t('太阳摩羯：耐心、有目标，用成就换尊重。', 'Sun in Capricorn: patient and goal-bound, earns respect through results.'),
  t('太阳水瓶：独立、理性，从群体的角度看问题。', 'Sun in Aquarius: independent and rational, thinks in terms of the group.'),
  t('太阳双鱼：敏感、包容，界线模糊但共情很强。', 'Sun in Pisces: sensitive and absorbing, vague on boundaries and strong on empathy.'),
];

export const MOON: readonly LocalizedText[] = [
  t('月亮白羊：情绪来得快去得快，需要马上行动才安心。', 'Moon in Aries: feelings flare and pass; acting on them is what settles you.'),
  t('月亮金牛：情绪求稳，靠熟悉的人和物来安抚。', 'Moon in Taurus: soothed by the familiar — same people, same places.'),
  t('月亮双子：用说话来消化情绪，独处太久会闷。', 'Moon in Gemini: you process by talking; too much silence gets heavy.'),
  t('月亮巨蟹：情绪深而敏感，家与照顾是核心需要。', 'Moon in Cancer: deep and easily moved; home and caring are the core need.'),
  t('月亮狮子：需要温暖的肯定，被忽视最伤。', 'Moon in Leo: needs warm recognition; being overlooked hurts most.'),
  t('月亮处女：靠整理和有用来安顿自己，容易自责。', 'Moon in Virgo: settled by order and usefulness; prone to self-criticism.'),
  t('月亮天秤：需要和谐，冲突时先让步再后悔。', 'Moon in Libra: needs harmony; yields in conflict and regrets it after.'),
  t('月亮天蝎：情绪强烈且藏得深，信任需要时间。', 'Moon in Scorpio: strong feelings kept hidden; trust takes time.'),
  t('月亮射手：情绪需要空间和盼头，被困住就烦躁。', 'Moon in Sagittarius: needs space and something to look forward to; restless when boxed in.'),
  t('月亮摩羯：情绪内敛克制，用做事来代替诉说。', 'Moon in Capricorn: contained and controlled; does instead of says.'),
  t('月亮水瓶：情绪先理性化，需要距离才自在。', 'Moon in Aquarius: rationalises feeling first; needs distance to be at ease.'),
  t('月亮双鱼：吸收周围的情绪，需要独处来清空。', 'Moon in Pisces: absorbs the room’s mood; needs solitude to empty out.'),
];

const ASC: readonly LocalizedText[] = [
  t('上升白羊：给人直接、有冲劲的第一印象。', 'Aries rising: comes across direct and driven.'),
  t('上升金牛：给人稳重、不慌不忙的第一印象。', 'Taurus rising: comes across calm and unhurried.'),
  t('上升双子：给人机灵、健谈的第一印象。', 'Gemini rising: comes across quick and talkative.'),
  t('上升巨蟹：给人温和、有保留的第一印象。', 'Cancer rising: comes across gentle and reserved.'),
  t('上升狮子：给人大方、有存在感的第一印象。', 'Leo rising: comes across warm and hard to miss.'),
  t('上升处女：给人细致、低调的第一印象。', 'Virgo rising: comes across precise and understated.'),
  t('上升天秤：给人得体、友善的第一印象。', 'Libra rising: comes across gracious and agreeable.'),
  t('上升天蝎：给人深沉、有距离感的第一印象。', 'Scorpio rising: comes across intense and guarded.'),
  t('上升射手：给人开朗、不拘小节的第一印象。', 'Sagittarius rising: comes across open and unfussy.'),
  t('上升摩羯：给人成熟、严肃的第一印象。', 'Capricorn rising: comes across mature and serious.'),
  t('上升水瓶：给人特别、有点疏离的第一印象。', 'Aquarius rising: comes across distinctive and a little detached.'),
  t('上升双鱼：给人柔和、难以捉摸的第一印象。', 'Pisces rising: comes across soft and hard to pin down.'),
];

/** What each planet "does", as a verb phrase that takes a house theme. */
const PLANET_DOES: Record<Exclude<PlanetKey, 'Sun' | 'Moon'>, LocalizedText> = {
  Mercury: t('思考与表达', 'thinking and talking'),
  Venus: t('爱与享受', 'loving and enjoying'),
  Mars: t('冲劲与争取', 'drive and pursuit'),
  Jupiter: t('机会与扩张', 'luck and growth'),
  Saturn: t('责任与考验', 'duty and testing'),
  Uranus: t('突破与不安分', 'disruption and restlessness'),
  Neptune: t('理想与迷惘', 'idealism and blur'),
  Pluto: t('深层转化', 'deep transformation'),
};

export const HOUSE: readonly LocalizedText[] = [
  t('自我与外在形象', 'the self and how you come across'),
  t('金钱与自我价值', 'money and self-worth'),
  t('沟通、学习与手足', 'communication, learning and siblings'),
  t('家庭与根源', 'home and roots'),
  t('恋爱、创造与子女', 'romance, creativity and children'),
  t('工作日常与健康', 'daily work and health'),
  t('伴侣与合作', 'partnership and one-to-one bonds'),
  t('亲密、共享资源与危机', 'intimacy, shared resources and crisis'),
  t('信念、远行与高等教育', 'beliefs, travel and higher learning'),
  t('事业与社会地位', 'career and public standing'),
  t('朋友、群体与愿景', 'friends, groups and hopes'),
  t('潜意识、隐退与放下', 'the unconscious, retreat and letting go'),
];

const ASPECT_TEXT: Record<AspectKind, LocalizedText> = {
  conjunction: t('合相：两者融为一体，彼此放大', 'conjunct — fused, each amplifies the other'),
  opposition: t('对分相：两者拉扯，需要在中间找平衡', 'opposite — a tug of war that wants a middle'),
  trine: t('三分相：两者顺畅配合，是天生的顺手', 'trine — flows easily, a natural talent'),
  square: t('四分相：两者摩擦，压力也是动力', 'square — friction, the pressure that also drives'),
  sextile: t('六分相：两者相助，但要主动去用', 'sextile — helpful, but only if you reach for it'),
};

export interface NatalReading {
  readonly sun: LocalizedText;
  readonly moon: LocalizedText;
  readonly ascendant: LocalizedText | null;
  readonly placements: readonly LocalizedText[];
  readonly aspects: readonly LocalizedText[];
}

const name = (k: PlanetKey): LocalizedText => PLANETS.find((p) => p.key === k)!.name;

const ordinal = (n: number): string =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor(n / 10) === 1 ? 0 : n % 10]}`;

export function readNatal(chart: NatalChart): NatalReading {
  const sun = chart.planets.find((p) => p.key === 'Sun')!;
  const moon = chart.planets.find((p) => p.key === 'Moon')!;
  const ascSign = chart.ascendant === null ? null : Math.floor(chart.ascendant / 30);

  const placements = chart.planets
    .filter((p) => p.key !== 'Sun' && p.key !== 'Moon')
    .map((p) => {
      const does = PLANET_DOES[p.key as keyof typeof PLANET_DOES];
      const sign = SIGNS[p.sign]!;
      const retroZh = p.retrograde ? '（逆行，向内多于向外）' : '';
      const retroEn = p.retrograde ? ' (retrograde: turned inward)' : '';
      if (p.house === null) {
        return t(
          `${name(p.key).zh}在${sign.zh}${retroZh}：${does.zh}带着${sign.zh}的色彩。`,
          `${name(p.key).en} in ${sign.en}${retroEn}: ${does.en} carries a ${sign.en} colour.`,
        );
      }
      const house = HOUSE[p.house - 1]!;
      return t(
        `${name(p.key).zh}在第${p.house}宫（${sign.zh}）${retroZh}：${does.zh}落在${house.zh}。`,
        `${name(p.key).en} in the ${ordinal(p.house)} house (${sign.en})${retroEn}: ${does.en} plays out in ${house.en}.`,
      );
    });

  const aspects = chart.aspects.slice(0, 6).map((a) => {
    const [zhName, zhGloss] = ASPECT_TEXT[a.kind].zh.split('：');
    return t(
      `${name(a.a).zh}${zhName}${name(a.b).zh}，${zhGloss}（容许度 ${a.orb.toFixed(1)}°）。`,
      `${name(a.a).en} ${ASPECT_TEXT[a.kind].en} ${name(a.b).en} (orb ${a.orb.toFixed(1)}°).`,
    );
  });

  return {
    sun: SUN[sun.sign]!,
    moon: MOON[moon.sign]!,
    ascendant: ascSign === null ? null : ASC[ascSign]!,
    placements,
    aspects,
  };
}
