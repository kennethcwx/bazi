/**
 * Two charts against the calendar: how a day sits for each of you, how it sits
 * between you, and which 时辰 within it are least abrasive for talking.
 *
 * The same caution as the solo forecast applies, doubled. 流日 is the lightest
 * layer in the system and 时辰 is lighter still. Nothing here predicts an
 * outcome. What it does is answer a scheduling question — if a conversation has
 * to happen this week, when does the calendar put least friction in the way —
 * and that is a question the method can actually address, because it is about
 * structure rather than fortune.
 *
 * Three separate readings per day, deliberately kept apart:
 *
 *   yours    — the day against your 日柱 alone
 *   theirs   — the day against their 日柱 alone
 *   between  — whether the day harmonises the two of you *with each other*
 *
 * A day can be easy for you and abrasive for them. Averaging that into one
 * number would hide exactly the thing worth knowing, the same reason 合婚
 * refuses a single match score.
 */

import { transitPillars } from '../../engine/chart';
import type { Chart, Element } from '../../engine/types';
import { t, type LocalizedText } from '../../i18n/text';
import { ELEMENT, RELATION } from '../../i18n/glossary';
import { controls, elementOfBranch, elementOfStem, generates } from '../elements';
import { findRelations, isBranchRelation, type PositionedPillar } from '../relations';
import { HOUR_MIDPOINTS, HOUR_RANGES, RELATION_WEIGHT, favourOf, layersOf } from './forecast';
import {
  bandOf, dayTenGod, isSpouseStar, MODE_LABEL, readPersonDay, stackNote, stackedOn, topMode,
  type Band, type Favour, type Form, type Layer, type LayerRead, type Mode, type TransitDay,
} from './dayread';
import { SolarTime } from 'tyme4ts';

export type Tone = 'easy' | 'friction' | null;

export interface SideDay {
  readonly band: Band;
  readonly tone: Tone;
  readonly mode: Mode;
  /** Steady or low on the day's elements; null for the pair reading. */
  readonly form: Form;
  readonly score: number;
  readonly notes: readonly LocalizedText[];
  /** The 流年 / 流月 this side's day shares a mode with; empty when quiet or
   *  for the pair reading, which has no single chart to read a layer from. */
  readonly stacked: readonly Layer[];
}

export interface JointDay {
  readonly date: string;
  readonly ganZhi: string;
  readonly yours: SideDay;
  readonly theirs: SideDay;
  /** How the day sits between the two of you, rather than for either alone. */
  readonly between: SideDay;
  /** Highest of the three, for sorting and for the strip. */
  readonly score: number;
}

export type HourSide = 'harmony' | 'clash' | null;

export interface HourOutlook {
  readonly index: number;
  readonly branch: string;
  readonly ganZhi: string;
  readonly range: string;
  /** How the hour sits with each person's 日支, reported per side. */
  readonly forYou: HourSide;
  readonly forThem: HourSide;
  /** avoid = it clashes someone; good = it harmonises someone and clashes
   *  no one; neutral = it does neither. */
  readonly band: 'good' | 'neutral' | 'avoid';
  readonly notes: readonly LocalizedText[];
}

export interface JointForecast {
  readonly from: string;
  readonly to: string;
  readonly days: readonly JointDay[];
  readonly headline: LocalizedText;
  readonly caveat: LocalizedText;
  /** Each person's 流年 and 流月, read against their own palace. */
  readonly layers: {
    readonly yours: { readonly year: LayerRead; readonly month: LayerRead };
    readonly theirs: { readonly year: LayerRead; readonly month: LayerRead };
  };
}

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** How the day sits for one person, through the relationship lens. */
function scoreSide(
  chart: Chart, favour: Favour, day: TransitDay,
  layers?: { year: LayerRead; month: LayerRead },
): SideDay {
  const r = readPersonDay(chart, favour, day);
  const stacked = layers ? stackedOn(r.mode, [layers.year, layers.month]) : [];
  return {
    band: r.band,
    tone: r.balance > 0 ? 'easy' : r.balance < 0 ? 'friction' : null,
    mode: r.mode,
    form: r.form,
    score: r.score,
    notes: stacked.length ? [...r.notes, stackNote(r.mode, stacked)] : r.notes,
    stacked,
  };
}

/**
 * Whether the day brings the two of you together.
 *
 * Read from the two 日支 rather than from either chart alone: a day that
 * combines with both is a day the pair sits well on, and one that clashes both
 * is a day to leave alone. Three further things only a pair can show:
 *
 *   - the day completing a 三合/三会 with BOTH 日支 — the two of you and the
 *     day forming one current; the strongest pair day there is
 *   - 通关: when your two 日主 control each other, a day carrying the element
 *     that stands between them eases that structural tension
 *   - the day's stem carrying both of your spouse stars at once
 */
function scoreBetween(self: Chart, partner: Chart, day: PositionedPillar): SideDay {
  const notes: LocalizedText[] = [];
  const votes: Record<Mode, number> = { close: 0, stirred: 0, friction: 0, apart: 0, quiet: 0 };
  let score = 0;
  let easy = 0;
  let rough = 0;

  const pair: PositionedPillar[] = [
    { position: '你日柱', stem: self.pillars.day.stem, branch: self.pillars.day.branch },
    { position: '对方日柱', stem: partner.pillars.day.stem, branch: partner.pillars.day.branch },
  ];

  const hits = findRelations([...pair, day])
    .filter((r) => r.positions.includes(day.position) && isBranchRelation(r));

  const touchesYou = hits.some((r) => r.positions.includes('你日柱'));
  const touchesThem = hits.some((r) => r.positions.includes('对方日柱'));
  const oneCurrent = hits.find((r) =>
    (r.kind === '三合' || r.kind === '三会')
      && r.positions.includes('你日柱') && r.positions.includes('对方日柱'));

  // A hit on one side alone already belongs to that person's own reading;
  // here it only scores when the day reaches both of you.
  for (const r of hits) {
    const weight = RELATION_WEIGHT[r.kind];
    if (weight === 0) continue;
    if (touchesYou && touchesThem) score += weight;
    if (r.polarity === 'harmonising') { easy++; votes.close += weight; }
    else { rough++; votes.friction += weight; }
  }

  if (oneCurrent) {
    score += 3;
    votes.close += 3;
    notes.push(t(
      `流日与两人日支合成${oneCurrent.kind}（${oneCurrent.values.join('')}），把两人拉进同一股气里——这几天里最像“一起”的一天`,
      `The day completes a ${RELATION[oneCurrent.kind]!.en} with both of your day branches (${oneCurrent.values.join('')}), pulling you into one current — the day in this window that most feels like "together"`,
    ));
  } else if (touchesYou && touchesThem) {
    // The day engages both marriage palaces at once, which is the case worth
    // flagging — it is doing something to the pair, not to one of you.
    score += 2;
    if (rough === 0) {
      votes.close += 2;
      notes.push(t(
        '流日同时合动两人日支，是这几天里最适合谈事情的一天。',
        'The day combines with both of your day branches at once — the best ' +
          'day here for a conversation that needs to land.',
      ));
    } else {
      votes.stirred += 2;
      notes.push(t(
        '流日同时牵动两人日支，气氛较满，谈得开也吵得起来。',
        'The day pulls on both of your day branches. Charged either way: ' +
          'things surface, and that cuts both ways.',
      ));
    }
  } else if (touchesYou !== touchesThem) {
    votes.apart += 1;
    notes.push(t(
      `流日只动${touchesYou ? '你' : '对方'}一边，一个人有话说，另一个未必在状态。`,
      `The day engages only ${touchesYou ? 'your' : 'their'} side. One of you has ` +
        `something to say; the other may not be in the same place.`,
    ));
  }

  // 通关: a mediator day between two day masters that control each other.
  const a = self.dayMasterElement;
  const b = partner.dayMasterElement;
  const dayEl = elementOfStem(day.stem);
  const controller = controls(a) === b ? a : controls(b) === a ? b : null;
  if (controller && dayEl === generates(controller)) {
    const controlled = controller === a ? b : a;
    score += 2;
    votes.close += 2;
    notes.push(t(
      `你们日主相克（${ELEMENT[controller]!.zh}克${ELEMENT[controlled]!.zh}），流日${ELEMENT[dayEl]!.zh}通关——两种性子之间的张力今天松一些`,
      `Your day masters control each other (${ELEMENT[controller]!.en} over ${ELEMENT[controlled]!.en}); today's ${ELEMENT[dayEl]!.en} mediates between them — the tension between your two natures eases`,
    ));
  }

  // Both spouse stars arriving on the same stem.
  if (isSpouseStar(self, dayTenGod(self, day.stem)) && isSpouseStar(partner, dayTenGod(partner, day.stem))) {
    score += 1;
    votes.stirred += 1;
    notes.push(t(
      '流日同时透出两人的配偶星——彼此都把对方放在心上',
      'The day carries both of your spouse stars at once — each of you has the other in mind',
    ));
  }

  const band = bandOf(score);
  const mode = topMode(votes);

  return {
    stacked: [],
    band,
    tone: easy > rough ? 'easy' : rough > easy ? 'friction' : null,
    mode: band === 'quiet' ? 'quiet' : mode,
    form: null,
    score,
    notes,
  };
}

export function forecastJoint(
  self: Chart,
  partner: Chart,
  fromDate: Date,
  days = 7,
): JointForecast {
  const span = Math.max(1, Math.min(31, days));
  const selfFavour = favourOf(self);
  const partnerFavour = favourOf(partner);

  const start = Date.UTC(
    fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate(),
  );
  const out: JointDay[] = [];
  const mid = new Date(start + Math.floor(span / 2) * 86_400_000);
  const layers = { yours: layersOf(self, mid), theirs: layersOf(partner, mid) };

  for (let i = 0; i < span; i++) {
    const date = new Date(start + i * 86_400_000);
    const cycle = transitPillars(
      date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
    ).day;
    const incoming: PositionedPillar = {
      position: '流日',
      stem: cycle.getHeavenStem().getName(),
      branch: cycle.getEarthBranch().getName(),
    };

    const yours = scoreSide(self, selfFavour, incoming, layers.yours);
    const theirs = scoreSide(partner, partnerFavour, incoming, layers.theirs);
    const between = scoreBetween(self, partner, incoming);

    out.push({
      date: iso(date),
      ganZhi: cycle.getName(),
      yours,
      theirs,
      between,
      score: Math.max(yours.score, theirs.score, between.score),
    });
  }

  const best = [...out].sort((a, b) => b.between.score - a.between.score)[0];
  const anyBetween = best && best.between.score >= 3;

  return {
    from: iso(new Date(start)),
    to: iso(new Date(start + (span - 1) * 86_400_000)),
    days: out,
    headline: anyBetween
      ? t(
          `这${span}天里，${best!.date}（${best!.ganZhi}）最牵动两人之间——` +
            `${MODE_LABEL[best!.between.mode].zh}。` +
            (best!.between.mode === 'friction'
              ? '要紧的事避开这天。'
              : '若有话要谈、有事要一起做，这天阻力最小。'),
          `Across these ${span} days, ${best!.date} (${best!.ganZhi}) does the most ` +
            `between the two of you — ${MODE_LABEL[best!.between.mode].en}. ` +
            (best!.between.mode === 'friction'
              ? 'Keep anything that matters off that day.'
              : 'If something needs saying or doing together, that day puts least in the way.'),
        )
      : t(
          `这${span}天没有同时牵动两人日支的日子。多数日子本就如此，` +
            `不必等某一天才开口。`,
          `No day in these ${span} engages both of your day branches. That is the ` +
            `normal state of things, and not a reason to wait for one.`,
        ),
    caveat: JOINT_CAVEAT,
    layers,
  };
}

export const JOINT_CAVEAT: LocalizedText = t(
  '这一层比流日更轻。它讲的是哪一天、哪个时辰在结构上阻力较小，' +
    '不是吉时，也不保证谈得成。真要紧的事，挑两个人都清醒的时候讲，比挑时辰有用。',
  'This layer is lighter than the daily one. It says which day and which 时辰 ' +
    'carry least structural friction. It is not an auspicious hour and it ' +
    'guarantees nothing. For anything that matters, picking a time you are both ' +
    'rested beats picking a 时辰.',
);

// ---------------------------------------------------------------------------

/**
 * The twelve 时辰 of one day, scored for how easily a conversation sits.
 *
 * An hour that combines with both day branches is calm ground; one that clashes
 * either is where a small remark becomes an argument. Favourable elements nudge
 * it, they do not decide it.
 *
 * The 时辰 from 23:00 belongs to the next day's cycle, so this covers the day's
 * own twelve and says as much rather than quietly folding it in.
 */
export function hourBreakdown(
  isoDate: string,
  self: Chart,
  partner: Chart | null,
  favourable: readonly Element[] = [],
): HourOutlook[] {
  const [y, m, d] = isoDate.split('-').map(Number);
  const fav = new Set(favourable);
  const out: HourOutlook[] = [];

  const pair: PositionedPillar[] = [
    { position: '你日柱', stem: self.pillars.day.stem, branch: self.pillars.day.branch },
    ...(partner
      ? [{ position: '对方日柱', stem: partner.pillars.day.stem, branch: partner.pillars.day.branch }]
      : []),
  ];

  HOUR_MIDPOINTS.forEach((h, index) => {
    const cycle = SolarTime.fromYmdHms(y!, m!, d!, h, 0, 0)
      .getSixtyCycleHour().getSixtyCycle();
    const branch = cycle.getEarthBranch().getName();
    const incoming: PositionedPillar = {
      position: '时辰', stem: cycle.getHeavenStem().getName(), branch,
    };

    const notes: LocalizedText[] = [];
    let forYou: HourSide = null;
    let forThem: HourSide = null;

    for (const r of findRelations([...pair, incoming])) {
      if (!r.positions.includes('时辰') || !isBranchRelation(r)) continue;
      const other = r.positions.find((p) => p !== '时辰');
      if (!other) continue;

      const mine = other === '你日柱';
      const whose = mine ? t('你', 'you') : t('对方', 'them');
      const rel = RELATION[r.kind]!;
      // 害 and 破 are blemishes rather than clashes; only a real 冲 or 刑
      // should rule an hour out.
      const severe = r.kind === '六冲' || r.kind === '相刑' || r.kind === '自刑';
      const verdict: HourSide = r.polarity === 'harmonising'
        ? 'harmony'
        : severe ? 'clash' : null;

      if (verdict === 'harmony') {
        notes.push(t(`${rel.zh}${whose.zh}日支，${whose.zh}较松`,
          `${rel.en} with ${whose.en} — ${whose.en} more at ease`));
      } else if (verdict === 'clash') {
        notes.push(t(`${rel.zh}${whose.zh}日支，${whose.zh}易起火`,
          `${rel.en} against ${whose.en} — ${whose.en} quicker to bristle`));
      }

      if (mine) forYou = forYou === 'clash' ? forYou : (verdict ?? forYou);
      else forThem = forThem === 'clash' ? forThem : (verdict ?? forThem);
    }

    const el = elementOfBranch(branch);
    if (fav.has(el)) {
      notes.push(t(`时支属${el}，为你的用神`,
        `The hour is ${ELEMENT[el]!.en}, which your chart needs`));
    }

    // Band is decided by the sides, not by a summed score. An hour can only
    // 六合 one branch, so any threshold that required harmonising both people
    // AND carrying a favourable element was unreachable in practice.
    const clashes = forYou === 'clash' || forThem === 'clash';
    const harmonises = forYou === 'harmony' || forThem === 'harmony';
    const band: HourOutlook['band'] = clashes ? 'avoid' : harmonises ? 'good' : 'neutral';

    out.push({ index, branch, ganZhi: cycle.getName(), range: HOUR_RANGES[index]!, forYou, forThem, band, notes });
  });

  return out;
}
