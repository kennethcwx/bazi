/**
 * 今日运势 — today's sky against the natal chart.
 *
 * A transit is a planet where it is *now* making an aspect to a planet where
 * it was at birth. The Moon does most of the daily work (it crosses the whole
 * zodiac in a month, so it touches something most days); the slow planets are
 * the backdrop, kept to a tight orb so they only speak when they are close.
 *
 * Three lenses — 综合 / 爱情 / 事业 — each reads the tightest transit that
 * concerns it, so the same sky yields three different lines rather than one
 * repeated. Composed from short tables, like the natal reading.
 * ponytail: no applying/separating distinction; add if a reader wants
 * "building" vs "fading".
 */

import { t, type LocalizedText } from '../i18n/text';
import { longitude, PLANETS, type AspectKind, type NatalChart, type PlanetKey } from './natal';
import { MOON } from './readings';

export type Lens = 'general' | 'love' | 'work';
export const LENSES: readonly Lens[] = ['general', 'love', 'work'];

export interface Transit {
  /** Transiting planet. */
  readonly t: PlanetKey;
  /** Natal planet. */
  readonly n: PlanetKey;
  readonly kind: AspectKind;
  readonly orb: number;
  /** orb / allowed orb, 0 = exact. Ranks transits across bodies fairly. */
  readonly tightness: number;
}

export interface DailySky {
  readonly moonSign: number;
  readonly transits: readonly Transit[];
}

const ANGLES: Record<AspectKind, number> = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
const ORB: Record<PlanetKey, number> = {
  Moon: 6, Sun: 3, Mercury: 3, Venus: 3, Mars: 3,
  Jupiter: 2, Saturn: 2, Uranus: 1.5, Neptune: 1.5, Pluto: 1.5,
};

const GENERATIONAL = new Set<PlanetKey>(['Uranus', 'Neptune', 'Pluto']);

export function computeTransits(natal: NatalChart, nowMs: number): DailySky {
  const now = new Date(nowMs);
  const transits: Transit[] = [];
  for (const { key: tk } of PLANETS) {
    const tl = longitude(tk, now);
    for (const np of natal.planets) {
      // Outer-to-outer holds for years and is the same for everyone born
      // that decade — not a daily reading's business.
      if (GENERATIONAL.has(tk) && GENERATIONAL.has(np.key)) continue;
      const sep = Math.abs(((tl - np.lon + 540) % 360) - 180);
      for (const kind of Object.keys(ANGLES) as AspectKind[]) {
        const orb = Math.abs(sep - ANGLES[kind]);
        if (orb <= ORB[tk]) {
          transits.push({ t: tk, n: np.key, kind, orb, tightness: orb / ORB[tk] });
          break;
        }
      }
    }
  }
  transits.sort((a, b) => a.tightness - b.tightness);
  const moonLon = ((longitude('Moon', now) % 360) + 360) % 360;
  return { moonSign: Math.floor(moonLon / 30), transits };
}

/* ---------- reading ---------- */

/** What a transiting planet brings with it. */
const BRINGS: Record<PlanetKey, LocalizedText> = {
  Sun: t('今天的焦点', "today's focus"),
  Moon: t('今天的情绪', "today's mood"),
  Mercury: t('沟通与消息', 'talk and news'),
  Venus: t('好感与享受', 'affection and pleasure'),
  Mars: t('冲劲与摩擦', 'drive and friction'),
  Jupiter: t('机会与放大', 'opportunity and expansion'),
  Saturn: t('责任与考验', 'duty and testing'),
  Uranus: t('突如其来的变动', 'sudden change'),
  Neptune: t('模糊与灵感', 'blur and inspiration'),
  Pluto: t('深层的推力', 'a deep push'),
};

/** What a natal planet stands for in the person. */
const STANDS_FOR: Record<PlanetKey, LocalizedText> = {
  Sun: t('你的自我与精力', 'your sense of self and energy'),
  Moon: t('你的情绪需要', 'your emotional needs'),
  Mercury: t('你的思路与表达', 'your thinking and words'),
  Venus: t('你的感情与品味', 'your heart and taste'),
  Mars: t('你的行动力', 'your drive'),
  Jupiter: t('你的信心与运气', 'your confidence and luck'),
  Saturn: t('你的底线与纪律', 'your limits and discipline'),
  Uranus: t('你的求变之心', 'your need to break pattern'),
  Neptune: t('你的理想与直觉', 'your ideals and intuition'),
  Pluto: t('你的深层动力', 'your deepest drives'),
};

/**
 * The one lens a planet speaks to. Natal side: what in the person is touched.
 * Transit side: what kind of weather it is. A transit belongs to a lens when
 * either end says so; a lens then takes the tightest transit no other lens
 * has claimed, love and work first so 综合 gets the leftovers rather than
 * the same headline three times.
 */
const NATAL_LENS: Record<PlanetKey, Lens> = {
  Sun: 'general', Moon: 'love', Mercury: 'work', Venus: 'love', Mars: 'work',
  Jupiter: 'general', Saturn: 'work', Uranus: 'general', Neptune: 'general', Pluto: 'general',
};
const TRANSIT_LENS: Record<PlanetKey, Lens> = {
  Sun: 'general', Moon: 'general', Mercury: 'work', Venus: 'love', Mars: 'work',
  Jupiter: 'general', Saturn: 'work', Uranus: 'general', Neptune: 'general', Pluto: 'general',
};

type Tone = 'flow' | 'strain' | 'fuse';
const TONE: Record<AspectKind, Tone> = { trine: 'flow', sextile: 'flow', square: 'strain', opposition: 'strain', conjunction: 'fuse' };

const ASPECT_NAME: Record<AspectKind, LocalizedText> = {
  conjunction: t('合', 'conjunct'), opposition: t('冲', 'opposite'), trine: t('拱', 'trine'),
  square: t('刑', 'square'), sextile: t('六合', 'sextile'),
};

/** How each lens phrases each tone: (brings, standsFor) → sentence. */
const PHRASE: Record<Lens, Record<Tone, (b: LocalizedText, s: LocalizedText) => LocalizedText>> = {
  general: {
    flow: (b, s) => t(`${b.zh}与${s.zh}合拍，顺势去做就好。`, `${cap(b.en)} works with ${s.en} — go with it.`),
    strain: (b, s) => t(`${b.zh}与${s.zh}相冲，先缓一步再回应。`, `${cap(b.en)} pulls against ${s.en}; pause before you respond.`),
    fuse: (b, s) => t(`${b.zh}正压在${s.zh}上，今天绕不开它。`, `${cap(b.en)} sits right on ${s.en}; it will not be ignored today.`),
  },
  love: {
    flow: (b, s) => t(`感情上，${b.zh}顺着${s.zh}走，适合表达与靠近。`, `In love, ${b.en} flows with ${s.en}: a day to say it and move closer.`),
    strain: (b, s) => t(`感情上，${b.zh}与${s.zh}不同步，别把一时的情绪当结论。`, `In love, ${b.en} is out of step with ${s.en}; don't mistake a mood for a verdict.`),
    fuse: (b, s) => t(`感情上，${b.zh}直接触动${s.zh}，感受会比平时强烈。`, `In love, ${b.en} lands directly on ${s.en}; feelings run stronger than usual.`),
  },
  work: {
    flow: (b, s) => t(`工作上，${b.zh}帮到${s.zh}，推进事情的好日子。`, `At work, ${b.en} backs ${s.en}: a good day to push things forward.`),
    strain: (b, s) => t(`工作上，${b.zh}卡住${s.zh}，先把要求写清楚再动。`, `At work, ${b.en} snags on ${s.en}; get the ask in writing before you move.`),
    fuse: (b, s) => t(`工作上，${b.zh}集中在${s.zh}，今天会被推到台前。`, `At work, ${b.en} concentrates on ${s.en}; expect to be put on the spot.`),
  },
};

const QUIET: Record<Lens, LocalizedText> = {
  general: t('今天没有明显的天象触动本命盘，平稳的一天。', 'No transit touches your chart closely today — an even day.'),
  love: t('感情上没有明显的天象，照常相处即可。', 'Nothing notable in the sky for love today; carry on as usual.'),
  work: t('工作上没有明显的天象，适合处理日常。', 'Nothing notable for work today; a day for routine.'),
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pname = (k: PlanetKey) => PLANETS.find((p) => p.key === k)!.name;

export interface LensReading {
  readonly lens: Lens;
  /** 1–5: 3 is neutral, harmonious transits add, hard ones subtract. */
  readonly stars: number;
  /** The transit that drove the line, e.g. "月亮拱本命金星". */
  readonly source: LocalizedText | null;
  readonly text: LocalizedText;
}

export interface DailyReading {
  readonly moon: LocalizedText;
  readonly lenses: readonly LensReading[];
}

const concerns = (x: Transit, lens: Lens) => NATAL_LENS[x.n] === lens || TRANSIT_LENS[x.t] === lens;

export function readDaily(sky: DailySky): DailyReading {
  const used = new Set<Transit>();
  const byLens = new Map<Lens, LensReading>();
  for (const lens of ['love', 'work', 'general'] as const) {
    const mine = sky.transits.filter((x) => concerns(x, lens));
    const score = mine.reduce((acc, x) => acc + (TONE[x.kind] === 'flow' ? 1 : TONE[x.kind] === 'strain' ? -1 : 0), 0);
    const stars = Math.max(1, Math.min(5, 3 + Math.sign(score) * Math.min(2, Math.abs(score))));
    const top = mine.find((x) => !used.has(x));
    if (!top) { byLens.set(lens, { lens, stars: 3, source: null, text: QUIET[lens] }); continue; }
    used.add(top);
    const tn = pname(top.t); const nn = pname(top.n);
    byLens.set(lens, {
      lens,
      stars,
      source: t(`${tn.zh}${ASPECT_NAME[top.kind].zh}本命${nn.zh}`, `${tn.en} ${ASPECT_NAME[top.kind].en} natal ${nn.en}`),
      text: PHRASE[lens][TONE[top.kind]](BRINGS[top.t], STANDS_FOR[top.n]),
    });
  }
  const m = MOON[sky.moonSign]!;
  return {
    moon: t(`今日${m.zh}`, `Today's ${m.en}`),
    lenses: LENSES.map((l) => byLens.get(l)!),
  };
}

export const LENS_NAME: Record<Lens, LocalizedText> = {
  general: t('综合', 'General'), love: t('爱情', 'Love'), work: t('事业', 'Work'),
};
