/**
 * 合盘 — two natal charts laid over each other.
 *
 * Three things, in the order every synastry app agrees on:
 *   1. cross-aspects — my planet to their planet, the same geometry as a
 *      natal aspect but between charts, with slightly tighter orbs;
 *   2. house overlays — where their personal planets fall in my houses and
 *      mine in theirs (whole-sign, so only when the host's time is known);
 *   3. five factor scores — Starcrossed's breakdown: 性格 / 沟通 / 爱情 /
 *      性 / 情感 — each read from the tightest cross-aspect that concerns it.
 *
 * Scores are 0–100 around a neutral 50: harmonious and conjunct aspects add,
 * hard ones subtract, weighted by how exact they are. It is a summary of the
 * aspect list, not a verdict; the list is always shown beside it.
 * ponytail: no composite chart, no Davison; add if he compares against 测测's 组合盘.
 */

import { t, type LocalizedText } from '../i18n/text';
import { PLANETS, type AspectKind, type NatalChart, type PlanetKey } from './natal';
import { HOUSE } from './readings';

export interface CrossAspect {
  /** My planet. */
  readonly a: PlanetKey;
  /** Their planet. */
  readonly b: PlanetKey;
  readonly kind: AspectKind;
  readonly orb: number;
  /** orb / allowed orb, 0 = exact. */
  readonly tightness: number;
}

export interface Overlay {
  /** Whose planet: 'a' = mine in their house, 'b' = theirs in my house. */
  readonly of: 'a' | 'b';
  readonly planet: PlanetKey;
  readonly house: number;
}

export type Factor = 'personality' | 'communication' | 'love' | 'sexual' | 'emotional';
export const FACTORS: readonly Factor[] = ['personality', 'communication', 'love', 'sexual', 'emotional'];

export const FACTOR_NAME: Record<Factor, LocalizedText> = {
  personality: t('性格', 'Personality'),
  communication: t('沟通', 'Communication'),
  love: t('爱情', 'Love'),
  sexual: t('亲密', 'Sexual'),
  emotional: t('情感', 'Emotional'),
};

export interface FactorReading {
  readonly factor: Factor;
  readonly score: number;
  readonly source: LocalizedText | null;
  readonly text: LocalizedText;
}

export interface Synastry {
  readonly aspects: readonly CrossAspect[];
  readonly overlays: readonly Overlay[];
  readonly factors: readonly FactorReading[];
  readonly overall: number;
}

const ORBS: readonly { kind: AspectKind; angle: number; orb: number }[] = [
  { kind: 'conjunction', angle: 0, orb: 7 },
  { kind: 'opposition', angle: 180, orb: 7 },
  { kind: 'trine', angle: 120, orb: 6 },
  { kind: 'square', angle: 90, orb: 6 },
  { kind: 'sextile', angle: 60, orb: 4 },
];

const PERSONAL: readonly PlanetKey[] = ['Sun', 'Moon', 'Venus', 'Mars'];
const OUTER = new Set<PlanetKey>(['Uranus', 'Neptune', 'Pluto']);

/** Which planet pairs (unordered) each factor listens to. */
const PAIRS: Record<Factor, readonly [PlanetKey, readonly PlanetKey[]][]> = {
  personality: [['Sun', ['Sun', 'Moon', 'Mars', 'Jupiter', 'Saturn', 'Uranus']]],
  communication: [['Mercury', ['Mercury', 'Sun', 'Moon', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus']]],
  love: [['Venus', ['Sun', 'Moon', 'Venus', 'Jupiter', 'Saturn', 'Neptune']], ['Sun', ['Moon']]],
  sexual: [['Mars', ['Venus', 'Mars', 'Moon', 'Sun', 'Pluto']], ['Venus', ['Pluto']]],
  emotional: [['Moon', ['Moon', 'Venus', 'Sun', 'Saturn', 'Neptune', 'Pluto', 'Jupiter']]],
};

const concerns = (x: CrossAspect, f: Factor): boolean =>
  PAIRS[f].some(([p, qs]) =>
    (x.a === p && qs.includes(x.b)) || (x.b === p && qs.includes(x.a)));

type Tone = 'flow' | 'strain' | 'fuse';
const TONE: Record<AspectKind, Tone> = { trine: 'flow', sextile: 'flow', square: 'strain', opposition: 'strain', conjunction: 'fuse' };
const SIGN: Record<Tone, number> = { flow: 1, fuse: 1, strain: -1 };

export function computeSynastry(a: NatalChart, b: NatalChart): Synastry {
  const aspects: CrossAspect[] = [];
  for (const pa of a.planets) {
    for (const pb of b.planets) {
      // Outer-to-outer is generational, not a bond between two people.
      if (OUTER.has(pa.key) && OUTER.has(pb.key)) continue;
      const sep = Math.abs(((pa.lon - pb.lon + 540) % 360) - 180);
      for (const o of ORBS) {
        const orb = Math.abs(sep - o.angle);
        if (orb <= o.orb) {
          aspects.push({ a: pa.key, b: pb.key, kind: o.kind, orb, tightness: orb / o.orb });
          break;
        }
      }
    }
  }
  aspects.sort((x, y) => x.tightness - y.tightness);

  const overlays: Overlay[] = [];
  const ascA = a.ascendant === null ? null : Math.floor(a.ascendant / 30);
  const ascB = b.ascendant === null ? null : Math.floor(b.ascendant / 30);
  const houseIn = (lon: number, asc: number) => ((Math.floor(lon / 30) - asc + 12) % 12) + 1;
  for (const key of PERSONAL) {
    const pa = a.planets.find((p) => p.key === key)!;
    const pb = b.planets.find((p) => p.key === key)!;
    if (ascB !== null) overlays.push({ of: 'a', planet: key, house: houseIn(pa.lon, ascB) });
    if (ascA !== null) overlays.push({ of: 'b', planet: key, house: houseIn(pb.lon, ascA) });
  }

  const used = new Set<CrossAspect>();
  const byFactor = new Map<Factor, FactorReading>();
  // Love and sex first: they have the fewest candidate pairs, so they get
  // first pick before the broader factors take the same aspect.
  for (const f of ['love', 'sexual', 'emotional', 'communication', 'personality'] as const) {
    const mine = aspects.filter((x) => concerns(x, f));
    const sum = mine.reduce((acc, x) =>
      acc + SIGN[TONE[x.kind]] * (1 - x.tightness) * (OUTER.has(x.a) || OUTER.has(x.b) ? 0.5 : 1), 0);
    const score = Math.round(Math.max(0, Math.min(100, 50 + 25 * sum)));
    // Prefer an aspect no other factor has used; fall back to the tightest.
    const top = mine.find((x) => !used.has(x)) ?? mine[0];
    if (!top) { byFactor.set(f, { factor: f, score, source: null, text: QUIET }); continue; }
    used.add(top);
    const an = pname(top.a); const bn = pname(top.b);
    byFactor.set(f, {
      factor: f,
      score,
      source: t(`你的${an.zh}${ASPECT_NAME[top.kind].zh}对方的${bn.zh}`, `your ${an.en} ${ASPECT_NAME[top.kind].en} their ${bn.en}`),
      text: PHRASE[f][TONE[top.kind]](an, bn),
    });
  }
  const factors = FACTORS.map((f) => byFactor.get(f)!);
  const overall = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length);
  return { aspects, overlays, factors, overall };
}

/* ---------- copy ---------- */

const pname = (k: PlanetKey) => PLANETS.find((p) => p.key === k)!.name;

export const ASPECT_NAME: Record<AspectKind, LocalizedText> = {
  conjunction: t('合', 'conjunct'), opposition: t('冲', 'opposite'), trine: t('拱', 'trine'),
  square: t('刑', 'square'), sextile: t('六合', 'sextile'),
};

const QUIET = t('这一项没有明显的跨盘相位：靠相处养成，不是天生给的。',
  'No close cross-aspect here: this one is built by living together, not given.');

type Phrase = (a: LocalizedText, b: LocalizedText) => LocalizedText;
const PHRASE: Record<Factor, Record<Tone, Phrase>> = {
  personality: {
    flow: (a, b) => t(`你的${a.zh}与对方的${b.zh}合拍，相处不费力，彼此都能做自己。`,
      `Your ${a.en} and their ${b.en} get on: being together takes no effort, and neither has to perform.`),
    strain: (a, b) => t(`你的${a.zh}与对方的${b.zh}互相拉扯，一个想这样、一个想那样；给对方留空间。`,
      `Your ${a.en} and their ${b.en} pull different ways; leave each other room.`),
    fuse: (a, b) => t(`你的${a.zh}正合对方的${b.zh}，气质相近，像同一种人。`,
      `Your ${a.en} sits on their ${b.en}: alike in temperament, the same kind of person.`),
  },
  communication: {
    flow: (a, b) => t(`你的${a.zh}与对方的${b.zh}顺畅，话说得通，误会少。`,
      `Your ${a.en} and their ${b.en} flow: you follow each other with few misreadings.`),
    strain: (a, b) => t(`你的${a.zh}与对方的${b.zh}相刑，同一句话听出两个意思；重要的事写下来。`,
      `Your ${a.en} and their ${b.en} clash: the same sentence lands two ways. Put the important things in writing.`),
    fuse: (a, b) => t(`你的${a.zh}合对方的${b.zh}，思路同频，话常常不用说完。`,
      `Your ${a.en} on their ${b.en}: the same wavelength, sentences left half-finished.`),
  },
  love: {
    flow: (a, b) => t(`你的${a.zh}与对方的${b.zh}相拱，喜欢来得自然，也容易维持。`,
      `Your ${a.en} and their ${b.en} harmonise: fondness comes easily and keeps.`),
    strain: (a, b) => t(`你的${a.zh}与对方的${b.zh}相冲，吸引存在但节奏不一致；别用自己的方式去猜对方要什么。`,
      `Your ${a.en} and their ${b.en} clash: the pull is real but the timing differs. Don't guess what they want from what you'd want.`),
    fuse: (a, b) => t(`你的${a.zh}合对方的${b.zh}，是合盘里最经典的缘分相位之一。`,
      `Your ${a.en} on their ${b.en}: one of the classic bonding placements in synastry.`),
  },
  sexual: {
    flow: (a, b) => t(`你的${a.zh}与对方的${b.zh}相合，身体的默契不用学。`,
      `Your ${a.en} and their ${b.en} agree: chemistry that needs no teaching.`),
    strain: (a, b) => t(`你的${a.zh}与对方的${b.zh}相冲，火花强但容易擦枪走火；把它当能量，不当理由。`,
      `Your ${a.en} and their ${b.en} clash: a strong spark, quick to flare into a fight. Treat it as energy, not a verdict.`),
    fuse: (a, b) => t(`你的${a.zh}正合对方的${b.zh}，吸引力直接而强烈。`,
      `Your ${a.en} on their ${b.en}: attraction that is direct and strong.`),
  },
  emotional: {
    flow: (a, b) => t(`你的${a.zh}与对方的${b.zh}相拱，能感到被理解，不必解释情绪。`,
      `Your ${a.en} and their ${b.en} harmonise: you feel understood without explaining.`),
    strain: (a, b) => t(`你的${a.zh}与对方的${b.zh}相刑，你安抚对方的方式未必是对方要的；问，不要猜。`,
      `Your ${a.en} and their ${b.en} clash: how you soothe is not how they want soothing. Ask, don't assume.`),
    fuse: (a, b) => t(`你的${a.zh}合对方的${b.zh}，情绪彼此传染，好坏都是。`,
      `Your ${a.en} on their ${b.en}: moods pass between you, good and bad alike.`),
  },
};

const ordinal = (n: number): string =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor(n / 10) === 1 ? 0 : n % 10]}`;

/** "对方的月亮落在你的第4宫（家庭与根源）". */
export function overlayText(o: Overlay): LocalizedText {
  const p = pname(o.planet); const h = HOUSE[o.house - 1]!;
  return o.of === 'b'
    ? t(`对方的${p.zh}落在你的第${o.house}宫（${h.zh}）`, `Their ${p.en} falls in your ${ordinal(o.house)} house (${h.en})`)
    : t(`你的${p.zh}落在对方的第${o.house}宫（${h.zh}）`, `Your ${p.en} falls in their ${ordinal(o.house)} house (${h.en})`);
}

export function aspectText(x: CrossAspect): LocalizedText {
  const a = pname(x.a); const b = pname(x.b);
  return t(`你的${a.zh}${ASPECT_NAME[x.kind].zh}对方的${b.zh}`, `Your ${a.en} ${ASPECT_NAME[x.kind].en} their ${b.en}`);
}
