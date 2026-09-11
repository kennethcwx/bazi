/**
 * 流日 through the relationship lens — one person, one day.
 *
 * The solo forecast and both sides of the joint one read a day through this,
 * so the same day never means two different things on two screens.
 *
 * Before this existed the whole lens was one check — does the day's branch
 * 合 or 冲 the 日支 — worded every time as "easier to talk / quicker to
 * bristle". That folded a reading with several distinct parts into a
 * conversation-scheduling aid. The parts, each read separately here:
 *
 *   relation   what the day does to the 夫妻宫, by KIND — 六合 binds, 三合 pulls
 *              into one current, 六冲 disrupts and separates, 刑 is friction
 *              from obligation and old grievances, 害 quiet undermining,
 *              破 small things coming apart. Five different days, not two.
 *   mirror     伏吟 (the day IS your 日柱) and 天克地冲 — the days people notice.
 *   ten god    what the day's stem brings you: the spouse star turns attention
 *              toward the partner, 比劫 competes for it, 伤官 sharpens a
 *              woman's tongue toward 官, 印 wants looking after.
 *   神煞       the relationship stars landing on the day — 桃花 红鸾 天喜 红艳
 *              stir, 孤辰 寡宿 驿马 pull apart.
 *   form       whether the day's elements are your 用神 or 忌神 — not an event,
 *              a background: steady or running on less.
 *
 * Only the first two SCORE. Relations and mirrors decide whether a day
 * registers at all, so the band distribution is unchanged and most days still
 * come out quiet. The ten god, the stars and the form are colour: always
 * named, and on a day that does register they vote on WHAT it says — one of
 * four modes, close / stirred / friction / apart, rather than good or bad.
 * Letting colour score was tried first; between them the ten god and the
 * stars touch most days of a month, and every other day turned "mild" — the
 * exact failure the tests count for.
 */

import { HeavenStem } from 'tyme4ts';
import type { Chart, Element, TenGod } from '../../engine/types';
import { t, type LocalizedText } from '../../i18n/text';
import { ELEMENT, TEN_GOD } from '../../i18n/glossary';
import { controls, elementOfBranch, elementOfStem, FAMILY_OF, type TenGodFamily } from '../elements';
import {
  findRelations, isBranchRelation, natalPillars, RELATION_WEIGHT,
  type PositionedPillar, type RelationKind,
} from '../relations';

export type Band = 'notable' | 'mild' | 'quiet';

/** What the day does, when it does something. */
export type Mode = 'close' | 'stirred' | 'friction' | 'apart' | 'quiet';

/** Whether the day's elements feed this person or drain them. */
export type Form = 'steady' | 'low' | null;

export interface Favour {
  readonly favourable: readonly Element[];
  readonly unfavourable: readonly Element[];
}

export interface PersonDay {
  readonly score: number;
  readonly band: Band;
  readonly mode: Mode;
  readonly form: Form;
  readonly notes: readonly LocalizedText[];
  /** Harmonising minus disturbing relation hits; the hour breakdown and the
   *  old tone field key off the sign. */
  readonly balance: number;
}

export interface TransitDay {
  readonly stem: string;
  readonly branch: string;
}

export const bandOf = (score: number): Band =>
  score >= 4 ? 'notable' : score >= 2 ? 'mild' : 'quiet';

export const MODE_LABEL: Record<Mode, LocalizedText> = {
  close: t('亲近', 'close'),
  stirred: t('牵动', 'stirred'),
  friction: t('摩擦', 'friction'),
  apart: t('各自', 'apart'),
  quiet: t('平', 'quiet'),
};

/** The spouse star: 财 for a man, 官杀 for a woman. */
export const spouseFamily = (chart: Chart): TenGodFamily =>
  chart.gender === 'male' ? '财' : '官杀';

/** The day stem's specific 十神 to this person's 日主. */
export function dayTenGod(chart: Chart, stem: string): TenGod {
  return HeavenStem.fromName(chart.dayMaster)
    .getTenStar(HeavenStem.fromName(stem)).getName() as TenGod;
}

// --- 神煞 tables. Duplicated narrowly from shensha.ts, which is written around
// natal pillars; here the question is whether the DAY lands on the star. ---

const PEACH: Record<string, string> = {
  申: '酉', 子: '酉', 辰: '酉', 亥: '子', 卯: '子', 未: '子',
  寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午',
};
const HONG_LUAN: Record<string, string> = {
  子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌',
  午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰',
};
const TIAN_XI: Record<string, string> = {
  子: '酉', 丑: '申', 寅: '未', 卯: '午', 辰: '巳', 巳: '辰',
  午: '卯', 未: '寅', 申: '丑', 酉: '子', 戌: '亥', 亥: '戌',
};
const HONG_YAN: Record<string, string> = {
  甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰',
  己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申',
};
const LONELY: Record<string, { gu: string; gua: string }> = {
  亥: { gu: '寅', gua: '戌' }, 子: { gu: '寅', gua: '戌' }, 丑: { gu: '寅', gua: '戌' },
  寅: { gu: '巳', gua: '丑' }, 卯: { gu: '巳', gua: '丑' }, 辰: { gu: '巳', gua: '丑' },
  巳: { gu: '申', gua: '辰' }, 午: { gu: '申', gua: '辰' }, 未: { gu: '申', gua: '辰' },
  申: { gu: '亥', gua: '未' }, 酉: { gu: '亥', gua: '未' }, 戌: { gu: '亥', gua: '未' },
};
const TRAVEL: Record<string, string> = {
  申: '寅', 子: '寅', 辰: '寅', 亥: '巳', 卯: '巳', 未: '巳',
  寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥',
};

/** How each relation kind against the 夫妻宫 reads, and which mode it votes for. */
const PALACE_RELATION: Partial<Record<RelationKind, { mode: Mode; text: (v: string) => LocalizedText }>> = {
  六合: {
    mode: 'close',
    text: (v) => t(
      `流日${v}六合夫妻宫——亲近、黏得住，话容易说到心里`,
      `Six Harmony with your Spouse Palace (${v}) — closeness: you bind rather than bristle, and what you say lands`,
    ),
  },
  三合: {
    mode: 'close',
    text: (v) => t(
      `流日与夫妻宫成三合（${v}）——同一股气流里，容易同步、一起做事`,
      `Triple Harmony with your Spouse Palace (${v}) — pulled into one current: easy to move in step and do something together`,
    ),
  },
  半合: {
    mode: 'close',
    text: (v) => t(
      `流日${v}半合夫妻宫——有靠拢之意，比平日更愿意配合`,
      `Half Harmony with your Spouse Palace (${v}) — a lean toward each other; more willing to go along than usual`,
    ),
  },
  三会: {
    mode: 'close',
    text: (v) => t(
      `流日与夫妻宫三会（${v}）——气聚一方，两人的事往前推`,
      `Directional Meeting with your Spouse Palace (${v}) — energy gathers on one side; matters between you get pushed forward`,
    ),
  },
  六冲: {
    mode: 'friction',
    text: (v) => t(
      `流日${v}冲夫妻宫——动荡之日：行程会变、有人往外走，争执也来得快`,
      `Clash against your Spouse Palace (${v}) — a disruptive day: plans shift, one of you is pulled away, and arguments start fast`,
    ),
  },
  相刑: {
    mode: 'friction',
    text: (v) => t(
      `流日${v}刑夫妻宫——摩擦来自责任与旧账，不是新事；别翻老账`,
      `Punishment on your Spouse Palace (${v}) — friction from obligations and old grievances, not anything new; don't reopen the ledger`,
    ),
  },
  自刑: {
    mode: 'friction',
    text: (v) => t(
      `夫妻宫自刑（${v}）——自己跟自己过不去，情绪往内走`,
      `Self-Punishment on your Spouse Palace (${v}) — you get in your own way; the mood turns inward`,
    ),
  },
  相害: {
    mode: 'friction',
    text: (v) => t(
      `流日${v}害夫妻宫——暗里的不舒服，不会吵，但会记下`,
      `Harm on your Spouse Palace (${v}) — quiet undermining: no argument, but something gets noted and kept`,
    ),
  },
  相破: {
    mode: 'friction',
    text: (v) => t(
      `流日${v}破夫妻宫——小事出岔，安排易破局`,
      `Break on your Spouse Palace (${v}) — small things go sideways; arrangements come apart`,
    ),
  },
};

/**
 * What the day stem brings, read as its 十神 to the 日主. The spouse star and
 * the star that competes with it vote on the mode; the rest are named so the
 * day has a character even when nothing is in play.
 */
function tenGodNote(chart: Chart, god: TenGod): { weight: number; mode: Mode | null; note: LocalizedText } {
  const male = chart.gender === 'male';
  const name = TEN_GOD[god]!;
  switch (god) {
    case '正财': return male
      ? { weight: 1, mode: 'stirred', note: t(
          '流日透正财，配偶星到位——心思自然转向另一半，宜体贴、宜安排两人的事',
          `${name.en} today, your spouse star — attention turns naturally to your partner; a day for thoughtfulness and plans for two`) }
      : { weight: 0, mode: null, note: t('流日透正财——务实、顾家用，把日子过稳的一天',
          `${name.en} today — practical and household-minded; a day for keeping things steady`) };
    case '偏财': return male
      ? { weight: 1, mode: 'stirred', note: t(
          '流日透偏财——魅力与异性缘偏旺，心思容易往外飘',
          `${name.en} today — charm and outside attention run high, and your focus drifts outward`) }
      : { weight: 0, mode: null, note: t('流日透偏财——手松、爱热闹，宜请客不宜算账',
          `${name.en} today — open-handed and sociable; a day for hosting, not for settling accounts`) };
    case '正官': return male
      ? { weight: 0, mode: null, note: t('流日透正官——守规矩、顾面子，做事按部就班',
          `${name.en} today — by the book and mindful of appearances; things go in order`) }
      : { weight: 1, mode: 'stirred', note: t(
          '流日透正官，配偶星到位——对方更在你心上，也更愿意负起责任',
          `${name.en} today, your spouse star — your partner is more on your mind, and more willing to carry their share`) };
    case '七杀': return male
      ? { weight: 0, mode: null, note: t('流日透七杀——压力大、脾气急，家里的事别硬碰',
          `${name.en} today — pressure and a short fuse; don't force anything at home`) }
      : { weight: 1, mode: 'stirred', note: t(
          '流日透七杀——被强势的人吸引，也容易被压着走；关系里的张力偏高',
          `${name.en} today — drawn to forceful people and easily pushed by them; tension in the relationship runs higher`) };
    case '比肩':
    case '劫财': return male
      ? { weight: 1, mode: 'apart', note: t(
          `流日透${god}，比劫争财——朋友、开销、别人的事都在抢你的注意力，另一半容易觉得排不上`,
          `${name.en} today — friends, spending and other people's business compete for your attention; your partner can feel last in line`) }
      : { weight: 0, mode: null, note: t(`流日透${god}——主见强、要自己来，少让一步会顺些`,
          `${name.en} today — strong-willed and self-reliant; yielding a little goes a long way`) };
    case '伤官': return male
      ? { weight: 0, mode: null, note: t('流日透伤官——话多、想表达，好玩也好聊，只是别说过头',
          `${name.en} today — talkative and expressive; playful and easy to talk with, as long as it stops short of too much`) }
      : { weight: 1, mode: 'friction', note: t(
          '流日透伤官，伤官见官——嘴比平日利，挑剔另一半的话说出口前先想一下',
          `${name.en} today (伤官见官) — a sharper tongue than usual; think before the critical remark about your partner leaves your mouth`) };
    case '食神': return { weight: 0, mode: null, note: t(
        '流日透食神——放松、想吃想玩，宜轻松相处',
        `${name.en} today — relaxed, in the mood to eat and play; good for easy company`) };
    case '正印':
    case '偏印': return { weight: 0, mode: null, note: t(
        `流日透${god}——想被照顾多过想付出，收多于给`,
        `${name.en} today — you would rather be looked after than do the looking after; receiving more than giving`) };
  }
}

/** Read one day for one person. */
export function readPersonDay(chart: Chart, favour: Favour, day: TransitDay): PersonDay {
  const natal = natalPillars(chart);
  const notes: LocalizedText[] = [];
  const votes: Record<Mode, number> = { close: 0, stirred: 0, friction: 0, apart: 0, quiet: 0 };
  let score = 0;
  let harmonising = 0;
  let disturbing = 0;
  let clashesPalace = false;

  // 1. Relations to the 夫妻宫, by kind.
  const withDay: PositionedPillar[] = [...natal, { position: '流日', stem: day.stem, branch: day.branch }];
  for (const r of findRelations(withDay)) {
    if (!r.positions.includes('流日') || !r.positions.includes('日柱') || !isBranchRelation(r)) continue;
    const weight = RELATION_WEIGHT[r.kind];
    const read = PALACE_RELATION[r.kind];
    if (weight === 0 || !read) continue;
    score += weight;
    votes[read.mode] += weight;
    if (r.polarity === 'harmonising') harmonising++; else disturbing++;
    if (r.kind === '六冲') clashesPalace = true;
    notes.push(read.text(r.values.join('–')));
  }

  // 2. Mirror days.
  const natalDay = chart.pillars.day;
  if (day.stem === natalDay.stem && day.branch === natalDay.branch) {
    score += 2;
    votes.apart += 2;
    notes.push(t(
      `流日${day.stem}${day.branch}与日柱伏吟——老话题又转回来，各自闷在心里；不是坏日子，是原地踏步的日子`,
      `The day repeats your Day Pillar (伏吟, ${day.stem}${day.branch}) — the same old subject comes round again and each of you sits with it alone; not a bad day, a day that goes nowhere`,
    ));
  } else if (clashesPalace) {
    const a = elementOfStem(day.stem);
    const b = chart.dayMasterElement;
    if (controls(a) === b || controls(b) === a) {
      score += 2;
      votes.friction += 2;
      notes.push(t(
        `流日${day.stem}${day.branch}与日柱天克地冲——少有的重日，别在这天做感情上的决定`,
        `Stem and branch both strike your Day Pillar (天克地冲, ${day.stem}${day.branch}) — one of the few genuinely heavy days; don't make a relationship decision on it`,
      ));
    }
  }

  // 3. What the day stem brings. Colour: votes, never scores.
  const god = dayTenGod(chart, day.stem);
  const tg = tenGodNote(chart, god);
  if (tg.mode) votes[tg.mode] += tg.weight;
  notes.push(tg.note);

  // 4. Relationship stars landing on the day.
  const yb = chart.pillars.year.branch;
  const db = natalDay.branch;
  const star = (hit: boolean, weight: number, mode: Mode, note: LocalizedText) => {
    if (!hit) return;
    votes[mode] += weight;
    notes.push(note);
  };
  const b = day.branch;
  star(b === PEACH[yb] || b === PEACH[db], 1, 'stirred', t(
    '流日逢桃花——异性缘、被注意的感觉都偏旺',
    'Peach Blossom falls today — attraction and the sense of being noticed run higher'));
  star(b === HONG_LUAN[yb], 1, 'stirred', t(
    '流日逢红鸾——喜事、约会、求婚这类事有气氛',
    'Red Phoenix (红鸾) today — the air suits courtship: a date, a celebration, a proposal'));
  star(b === TIAN_XI[yb], 1, 'stirred', t(
    '流日逢天喜——宜庆祝、宜把好消息说出口',
    'Heavenly Joy (天喜) today — a day for celebrating, and for good news said out loud'));
  star(b === HONG_YAN[chart.dayMaster], 1, 'stirred', t(
    '流日逢红艳——情绪浓、易动情',
    'Red Charm (红艳) today — feelings run strong and are easily stirred'));
  const lonely = LONELY[yb];
  star(b === lonely?.gu || b === lonely?.gua, 1, 'apart', t(
    `流日逢${b === lonely?.gu ? '孤辰' : '寡宿'}——就算在一起也容易觉得一个人，别把这天的冷清当真`,
    `${b === lonely?.gu ? 'Solitary Star (孤辰)' : 'Widow Star (寡宿)'} today — easy to feel alone even together; don't read the distance as real`));
  star(b === TRAVEL[yb] || b === TRAVEL[db], 1, 'apart', t(
    '流日逢驿马——有人在路上、在外头，聚少离多的一天',
    'Travelling Horse (驿马) today — one of you is on the move or away; more apart than together'));

  // 5. Form: background.
  const fav = new Set(favour.favourable);
  const unfav = new Set(favour.unfavourable);
  let lean = 0;
  for (const el of [elementOfStem(day.stem), elementOfBranch(day.branch)]) {
    if (fav.has(el)) lean++;
    else if (unfav.has(el)) lean--;
  }
  const form: Form = lean > 0 ? 'steady' : lean < 0 ? 'low' : null;
  const stemEl = elementOfStem(day.stem);
  if (form === 'steady') {
    notes.push(t(
      `今日${day.stem}${day.branch}带${ELEMENT[stemEl]!.zh}气，是你的用神——状态稳，扛得住事`,
      `Today's ${day.stem}${day.branch} carries ${ELEMENT[stemEl]!.en}, your favourable element — you are on steady ground and can carry things`,
    ));
  } else if (form === 'low') {
    notes.push(t(
      `今日${day.stem}${day.branch}是你的忌神之气——气短，别在这天硬撑或硬谈`,
      `Today's ${day.stem}${day.branch} runs on an element you do without — you have less in the tank; don't push through or force a talk`,
    ));
  }

  const band = bandOf(score);
  const mode: Mode = band === 'quiet' ? 'quiet' : topMode(votes);

  return { score, band, mode, form, notes, balance: harmonising - disturbing };
}

/**
 * Highest-voted mode. Ties go to the LATER entry, so colour can win one:
 * 半合 with 桃花 and 红鸾 on top is a stirred day, not a close one.
 */
export function topMode(votes: Record<Mode, number>): Mode {
  let best: Mode = 'close';
  for (const m of ['close', 'friction', 'stirred', 'apart'] as const) {
    if (votes[m] >= votes[best]) best = m;
  }
  return best;
}

/** Whether a 十神 family is this person's spouse star. */
export const isSpouseStar = (chart: Chart, god: TenGod): boolean =>
  FAMILY_OF[god] === spouseFamily(chart);
