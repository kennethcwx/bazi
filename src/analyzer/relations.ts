/**
 * 干支关系 — combinations, clashes, punishments, harms and breaks.
 *
 * These drive the timing half of the product. A marriage window, a job change,
 * a bad year: in practice all of them come down to an incoming 大运 or 流年
 * branch combining with or clashing against a natal branch, especially 日支
 * (the spouse palace).
 *
 * The function is deliberately generic over "positions" so the same detector
 * serves the natal chart alone and the natal chart plus incoming luck pillars.
 */

import type { Chart, Element } from '../engine/types';

export interface PositionedPillar {
  /** 年 / 月 / 日 / 时 / 大运 / 流年 — free-form so luck pillars can join. */
  readonly position: string;
  readonly stem: string;
  readonly branch: string;
}

export type RelationKind =
  | '天干五合'
  | '天干相冲'
  | '六合'
  | '三合'
  | '半合'
  | '三会'
  | '六冲'
  | '相刑'
  | '自刑'
  | '相害'
  | '相破';

export interface Relation {
  readonly kind: RelationKind;
  /** Positions taking part, in chart order. */
  readonly positions: readonly string[];
  /** The characters involved, e.g. ['寅','午','戌']. */
  readonly values: readonly string[];
  /** Element produced, for combinations that transform. */
  readonly resultElement: Element | null;
  /** Combinations bind and stabilise; clashes, punishments, harms and breaks
   *  disturb. Used by the topic analyzers to score a year as helpful or not. */
  readonly polarity: 'harmonising' | 'disturbing';
  readonly label: string;
}

/** 天干五合: 甲己合土 乙庚合金 丙辛合水 丁壬合木 戊癸合火 */
const STEM_COMBINE: readonly (readonly [string, string, Element])[] = [
  ['甲', '己', '土'], ['乙', '庚', '金'], ['丙', '辛', '水'],
  ['丁', '壬', '木'], ['戊', '癸', '火'],
];

/** 天干相冲: the four yang/yang and yin/yin pairs across the controlling axis. */
const STEM_CLASH: readonly (readonly [string, string])[] = [
  ['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸'],
];

/** 地支六合 */
const BRANCH_COMBINE: readonly (readonly [string, string, Element])[] = [
  ['子', '丑', '土'], ['寅', '亥', '木'], ['卯', '戌', '火'],
  ['辰', '酉', '金'], ['巳', '申', '水'], ['午', '未', '土'],
];

/** 三合局: the four triangles. The middle character is the cardinal one, and
 *  a pair only counts as 半合 when it includes that cardinal. */
const TRIPLE_COMBINE: readonly (readonly [readonly [string, string, string], Element])[] = [
  [['申', '子', '辰'], '水'],
  [['亥', '卯', '未'], '木'],
  [['寅', '午', '戌'], '火'],
  [['巳', '酉', '丑'], '金'],
];

/** 三会方: the seasonal trios. Stronger than 三合 when complete. */
const DIRECTIONAL: readonly (readonly [readonly [string, string, string], Element])[] = [
  [['寅', '卯', '辰'], '木'],
  [['巳', '午', '未'], '火'],
  [['申', '酉', '戌'], '金'],
  [['亥', '子', '丑'], '水'],
];

/** 六冲 */
const BRANCH_CLASH: readonly (readonly [string, string])[] = [
  ['子', '午'], ['丑', '未'], ['寅', '申'],
  ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
];

/** 相刑. 寅巳申 and 丑戌未 are three-way; 子卯 is a pair; 辰午酉亥 self-punish. */
const PUNISH_TRIPLES: readonly (readonly [string, string, string])[] = [
  ['寅', '巳', '申'], ['丑', '戌', '未'],
];
const PUNISH_PAIR: readonly [string, string] = ['子', '卯'];
const SELF_PUNISH = new Set(['辰', '午', '酉', '亥']);

/** 六害 */
const BRANCH_HARM: readonly (readonly [string, string])[] = [
  ['子', '未'], ['丑', '午'], ['寅', '巳'],
  ['卯', '辰'], ['申', '亥'], ['酉', '戌'],
];

/** 相破 */
const BRANCH_BREAK: readonly (readonly [string, string])[] = [
  ['子', '酉'], ['卯', '午'], ['辰', '丑'],
  ['未', '戌'], ['寅', '亥'], ['巳', '申'],
];

function pairsOf<T>(items: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) out.push([items[i]!, items[j]!]);
  }
  return out;
}

function matchPair(
  a: PositionedPillar, b: PositionedPillar,
  x: string, y: string,
  pick: (p: PositionedPillar) => string,
): boolean {
  return (
    (pick(a) === x && pick(b) === y) || (pick(a) === y && pick(b) === x)
  );
}

export function findRelations(pillars: readonly PositionedPillar[]): Relation[] {
  const out: Relation[] = [];
  const pairs = pairsOf(pillars);

  // --- Stems ---
  for (const [a, b] of pairs) {
    for (const [x, y, el] of STEM_COMBINE) {
      if (matchPair(a, b, x, y, (p) => p.stem)) {
        out.push({
          kind: '天干五合',
          positions: [a.position, b.position],
          values: [a.stem, b.stem],
          resultElement: el,
          polarity: 'harmonising',
          label: `${a.stem}${b.stem}合${el}`,
        });
      }
    }
    for (const [x, y] of STEM_CLASH) {
      if (matchPair(a, b, x, y, (p) => p.stem)) {
        out.push({
          kind: '天干相冲',
          positions: [a.position, b.position],
          values: [a.stem, b.stem],
          resultElement: null,
          polarity: 'disturbing',
          label: `${a.stem}${b.stem}相冲`,
        });
      }
    }
  }

  // --- Three-branch structures, checked before pairs so a complete 三合 is
  //     reported as itself rather than as two unrelated 半合. ---
  const claimedByTriple = new Set<string>();

  for (const [trio, el] of DIRECTIONAL) {
    const found = trio.map((ch) => pillars.find((p) => p.branch === ch));
    if (found.every((f): f is PositionedPillar => !!f)) {
      out.push({
        kind: '三会',
        positions: found.map((f) => f.position),
        values: [...trio],
        resultElement: el,
        polarity: 'harmonising',
        label: `${trio.join('')}三会${el}局`,
      });
      for (const f of found) claimedByTriple.add(f.position);
    }
  }

  for (const [trio, el] of TRIPLE_COMBINE) {
    const found = trio.map((ch) => pillars.find((p) => p.branch === ch));
    if (found.every((f): f is PositionedPillar => !!f)) {
      out.push({
        kind: '三合',
        positions: found.map((f) => f.position),
        values: [...trio],
        resultElement: el,
        polarity: 'harmonising',
        label: `${trio.join('')}三合${el}局`,
      });
      for (const f of found) claimedByTriple.add(f.position);
      continue;
    }
    // 半合 needs the cardinal (the middle character) plus one wing.
    const cardinal = pillars.find((p) => p.branch === trio[1]);
    if (!cardinal) continue;
    for (const wing of [trio[0], trio[2]]) {
      const w = pillars.find((p) => p.branch === wing);
      if (!w) continue;
      if (claimedByTriple.has(cardinal.position) && claimedByTriple.has(w.position)) continue;
      out.push({
        kind: '半合',
        positions: [w.position, cardinal.position],
        values: [wing, trio[1]],
        resultElement: el,
        polarity: 'harmonising',
        label: `${wing}${trio[1]}半合${el}`,
      });
    }
  }

  for (const trio of PUNISH_TRIPLES) {
    const found = trio.map((ch) => pillars.find((p) => p.branch === ch));
    if (found.every((f): f is PositionedPillar => !!f)) {
      out.push({
        kind: '相刑',
        positions: found.map((f) => f.position),
        values: [...trio],
        resultElement: null,
        polarity: 'disturbing',
        label: `${trio.join('')}三刑`,
      });
    }
  }

  // --- Branch pairs ---
  for (const [a, b] of pairs) {
    for (const [x, y, el] of BRANCH_COMBINE) {
      if (matchPair(a, b, x, y, (p) => p.branch)) {
        out.push({
          kind: '六合',
          positions: [a.position, b.position],
          values: [a.branch, b.branch],
          resultElement: el,
          polarity: 'harmonising',
          label: `${a.branch}${b.branch}六合`,
        });
      }
    }
    for (const [x, y] of BRANCH_CLASH) {
      if (matchPair(a, b, x, y, (p) => p.branch)) {
        out.push({
          kind: '六冲',
          positions: [a.position, b.position],
          values: [a.branch, b.branch],
          resultElement: null,
          polarity: 'disturbing',
          label: `${a.branch}${b.branch}相冲`,
        });
      }
    }
    if (matchPair(a, b, PUNISH_PAIR[0], PUNISH_PAIR[1], (p) => p.branch)) {
      out.push({
        kind: '相刑',
        positions: [a.position, b.position],
        values: [a.branch, b.branch],
        resultElement: null,
        polarity: 'disturbing',
        label: '子卯相刑（无礼之刑）',
      });
    }
    for (const [x, y] of BRANCH_HARM) {
      if (matchPair(a, b, x, y, (p) => p.branch)) {
        out.push({
          kind: '相害',
          positions: [a.position, b.position],
          values: [a.branch, b.branch],
          resultElement: null,
          polarity: 'disturbing',
          label: `${a.branch}${b.branch}相害`,
        });
      }
    }
    for (const [x, y] of BRANCH_BREAK) {
      if (matchPair(a, b, x, y, (p) => p.branch)) {
        out.push({
          kind: '相破',
          positions: [a.position, b.position],
          values: [a.branch, b.branch],
          resultElement: null,
          polarity: 'disturbing',
          label: `${a.branch}${b.branch}相破`,
        });
      }
    }
    // 自刑 needs the same character twice, in two different positions.
    if (a.branch === b.branch && SELF_PUNISH.has(a.branch)) {
      out.push({
        kind: '自刑',
        positions: [a.position, b.position],
        values: [a.branch, b.branch],
        resultElement: null,
        polarity: 'disturbing',
        label: `${a.branch}${a.branch}自刑`,
      });
    }
  }

  return resolveOverlaps(out);
}

/**
 * Some branch pairs appear in more than one classical table: 寅亥 is both 六合
 * and 相破, and 巳申 is 六合, 相刑 AND 相破 at once. Scoring each separately
 * triple-counts one relationship and lets a chart look far busier than it is.
 *
 * Convention: 合 dominates. We keep the combination and fold the lesser
 * readings into its label, so the information survives without inflating the
 * count or the score.
 */
function resolveOverlaps(relations: readonly Relation[]): Relation[] {
  const key = (r: Relation) => [...r.positions].sort().join('|');
  const combines = new Map<string, Relation>();
  for (const r of relations) {
    if (r.kind === '六合') combines.set(key(r), r);
  }
  if (combines.size === 0) return [...relations];

  const shadowed = new Map<string, string[]>();
  const kept: Relation[] = [];

  for (const r of relations) {
    const k = key(r);
    const combine = combines.get(k);
    if (combine && (r.kind === '相破' || r.kind === '相刑') && r !== combine) {
      shadowed.set(k, [...(shadowed.get(k) ?? []), r.kind]);
      continue;
    }
    kept.push(r);
  }

  return kept.map((r) => {
    const extra = r.kind === '六合' ? shadowed.get(key(r)) : undefined;
    if (!extra || extra.length === 0) return r;
    return { ...r, label: `${r.label}（兼${extra.join('、')}，以合为主）` };
  });
}

/**
 * How much weight each relation carries.
 *
 * 六合, 三合 and 冲 are the ones classical practice actually reads. 害, 破 and
 * 自刑 are minor blemishes — real, but not enough on their own to say anything.
 * Graded so a minor relation alone leaves things where it found them.
 *
 * Lives here rather than in a topic module because three callers now grade on
 * it: the 流日 forecast, the joint hour bands, and the 旺衰 weighting. One
 * table, so a change to what counts as major reaches all three.
 */
export const RELATION_WEIGHT: Record<RelationKind, number> = {
  六合: 3, 三合: 3, 三会: 3, 六冲: 3,
  半合: 2, 相刑: 2,
  相害: 1, 相破: 1, 自刑: 1,
  // Stem relations never reach a branch; filtered out before this is used.
  天干五合: 0, 天干相冲: 0,
};

/** The natal pillars of a chart, in the shape the relation finder wants. */
export function natalPillars(chart: Chart): PositionedPillar[] {
  return [
    { position: '年柱', stem: chart.pillars.year.stem, branch: chart.pillars.year.branch },
    { position: '月柱', stem: chart.pillars.month.stem, branch: chart.pillars.month.branch },
    { position: '日柱', stem: chart.pillars.day.stem, branch: chart.pillars.day.branch },
    ...(chart.pillars.hour
      ? [{ position: '时柱', stem: chart.pillars.hour.stem, branch: chart.pillars.hour.branch }]
      : []),
  ];
}

/** Stem-level relations. Everything else acts on branches, and the difference
 *  matters: 夫妻宫 is the day BRANCH, so a stem clash does not disturb it. */
const STEM_KINDS = new Set<RelationKind>(['天干五合', '天干相冲']);

export const isBranchRelation = (r: Relation): boolean => !STEM_KINDS.has(r.kind);

/** Relations touching a specific position — e.g. everything hitting 日支. */
export function relationsAt(
  relations: readonly Relation[],
  position: string,
): Relation[] {
  return relations.filter((r) => r.positions.includes(position));
}
