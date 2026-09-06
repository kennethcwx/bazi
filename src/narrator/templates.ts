/**
 * The question surface.
 *
 * Deliberately NOT a free-text chatbot. Each template binds to a specific set
 * of findings, which buys four things a chatbot cannot: bounded cost, a prompt
 * that can be reviewed, a reading that stays consistent between runs, and a
 * grounding check that actually means something.
 *
 * Free-text input is routed to the nearest template rather than answered
 * directly — see `routeQuestion` at the bottom.
 */

import type { Topic } from '../analyzer/findings';

export interface Template {
  readonly id: string;
  readonly topic: Exclude<Topic, 'base'>;
  /** What the user sees on the button. */
  readonly question: string;
  /** One line of context under it. */
  readonly hint: string;
  /**
   * Finding ids this template leans on, most important first. Findings not
   * listed are still supplied as background — the ordering tells the narrator
   * what to lead with, it does not restrict what it may cite.
   */
  readonly leadWith: readonly string[];
  /** What this answer is for. Goes into the prompt verbatim. */
  readonly focus: string;
  /** Rough length target, in Chinese characters. */
  readonly targetLength: number;
  /** Keywords that route free text here. */
  readonly matches: readonly string[];
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'rel.overview',
    topic: 'relationship',
    question: '我的感情大概是什么格局？',
    hint: '夫妻宫、配偶星与整体走向',
    leadWith: ['rel.palace.content', 'rel.star.absent', 'rel.star.hidden', 'rel.star.exposed', 'rel.star.favourable', 'rel.star.unfavourable'],
    focus:
      '先讲这个命局在感情上的基本盘：夫妻宫坐什么、配偶星在不在、婚姻对本人是助力还是负担。' +
      '收尾给一句这个人在感情里最需要留意的事。',
    targetLength: 420,
    matches: ['感情', '姻缘', '婚姻', '爱情', 'relationship', 'love', 'marriage'],
  },
  {
    id: 'rel.timing',
    topic: 'relationship',
    question: '什么时候比较容易成家？',
    hint: '大运流年引动夫妻宫的年份',
    leadWith: ['rel.timing.favourable', 'rel.timing.volatile', 'rel.palace.disturbed', 'rel.palace.stable'],
    focus:
      '讲婚缘的时机。若结论是"某个地支年反复引动"，要说清楚这是命局结构使然、约十二年一轮，' +
      '不是某一年独有的机缘——不要把结构性的规律写成四次独立的预言。' +
      '冲夫妻宫的年份主"变"，方向要看当时处境，不要替人断定是聚是散。',
    targetLength: 400,
    matches: ['什么时候', '何时', '几岁', '结婚', '成家', 'when', 'timing', 'marry'],
  },
  {
    id: 'rel.partner',
    topic: 'relationship',
    question: '我的另一半可能是什么样的人？',
    hint: '由夫妻宫与配偶星的性质推',
    leadWith: ['rel.palace.content', 'rel.star.exposed', 'rel.star.hidden', 'rel.shensha'],
    focus:
      '从夫妻宫本气的十神性质、配偶星的透藏与强弱，讲配偶大致的性情与两人的相处基调。' +
      '这一题最容易写成空话——务必扣住十神的具体含义，不要写放诸四海皆准的形容词。' +
      '不要描述外貌、职业或家世，命理不支持这种精度。',
    targetLength: 380,
    matches: ['另一半', '配偶', '对象', '什么样的人', 'partner', 'spouse'],
  },
  {
    id: 'rel.obstacles',
    topic: 'relationship',
    question: '为什么我的感情总是反复？',
    hint: '刑冲害破、比劫夺财、官杀混杂等',
    leadWith: ['rel.palace.disturbed', 'rel.male.competition', 'rel.female.mixed', 'rel.female.hurting-officer', 'rel.star.unfavourable'],
    focus:
      '讲这个命局在感情上的结构性难处，以及可以怎么应对。' +
      '若原局夫妻宫其实安稳、问题多来自大运流年，就要如实说明，不要为了回应问题而制造问题。' +
      '语气要像一个见过很多命的人在讲道理，不是在下判决。',
    targetLength: 400,
    matches: ['为什么', '不顺', '反复', '分手', '波折', 'why', 'breakup', 'problem'],
  },

  {
    id: 'career.overview',
    topic: 'career',
    question: '我的事业格局如何？',
    hint: '格局、十神偏向与整体走势',
    leadWith: ['career.structure', 'career.dominant', 'career.lean'],
    focus:
      '先讲格局与十神的偏向说明这个人做事的方式，再讲这决定了什么样的路走得顺。' +
      '格神透不透、成格破格，要讲清楚它对"方向是否清晰"的影响。',
    targetLength: 420,
    matches: ['事业', '工作', '格局', 'career', 'work'],
  },
  {
    id: 'career.field',
    topic: 'career',
    question: '我适合什么行业？',
    hint: '由用神五行推行业与方位',
    leadWith: ['career.industry', 'career.dominant', 'career.structure'],
    focus:
      '由用神五行讲行业方向与有利方位。给出的行业要具体可用，并说明为什么是这几类。' +
      '若调候与扶抑取用不一致，要说明两条路都有道理、行业上可以兼顾——这是流派差异，不是模棱两可。',
    targetLength: 380,
    matches: ['行业', '职业', '做什么', '方向', 'industry', 'field', 'job'],
  },
  {
    id: 'career.mode',
    topic: 'career',
    question: '我适合上班还是自己做？',
    hint: '身强弱与官印食伤财的配置',
    leadWith: ['career.lean', 'career.dominant', 'career.structure'],
    focus:
      '正面回答受雇或自营，并讲清楚判断的依据（身强弱、官印是否得力、食伤财是否成局）。' +
      '若结论是"两可"，就要说明在什么条件下适合哪一种，而不是含糊带过。',
    targetLength: 360,
    matches: ['创业', '上班', '打工', '自己做', '受雇', 'employed', 'business', 'startup'],
  },
  {
    id: 'career.timing',
    topic: 'career',
    question: '哪一段大运对事业最有利？',
    hint: '十步大运的用神得失',
    // career.timing.none is deliberately absent: ten consecutive decades cover
    // all ten stems, so at least two always carry a favourable stem and the
    // no-good-decade branch effectively never fires. It is still supplied as
    // background if it ever does.
    leadWith: ['career.timing.favourable', 'career.timing.mild', 'career.timing.adverse'],
    focus:
      '讲大运的起落，点出最得力与最需留意的阶段，并说明该怎么用。' +
      '若十步运里没有干支俱为用神的强运，要如实说事业靠积累多于际遇——这比编一个旺运有用。' +
      '不利的运讲成"不宜扩张"，不要讲成灾祸。',
    targetLength: 400,
    matches: ['大运', '什么时候', '哪一年', '运势', 'decade', 'luck', 'when'],
  },
];

export const templateById = (id: string): Template | undefined =>
  TEMPLATES.find((t) => t.id === id);

export const templatesFor = (topic: Exclude<Topic, 'base'>): Template[] =>
  TEMPLATES.filter((t) => t.topic === topic);

/** Questions we decline on principle — and which keep us out of trouble. */
const OUT_OF_SCOPE: readonly (readonly [RegExp, string])[] = [
  [/病|癌|健康|寿命|生死|几时死|活到|自杀/, '健康与寿命'],
  [/官司|坐牢|判刑|违法|法律/, '法律'],
  [/股票|彩票|赌|号码|买什么币|投资什么/, '博彩与具体投资标的'],
];

export type RouteResult =
  | { readonly kind: 'template'; readonly template: Template }
  | { readonly kind: 'declined'; readonly reason: string };

/**
 * Route free text to the nearest template, or decline.
 *
 * A cheap keyword router rather than a model call: it is the difference
 * between a bounded product and an open-ended oracle, and an LLM classifier
 * here would add latency and cost for a decision this crude handles well.
 */
export function routeQuestion(
  text: string,
  preferredTopic?: Exclude<Topic, 'base'>,
): RouteResult {
  for (const [pattern, subject] of OUT_OF_SCOPE) {
    if (pattern.test(text)) {
      return {
        kind: 'declined',
        reason:
          `这个盘不回答${subject}相关的问题。八字在这些事情上给不出可靠的答案，` +
          `讲了反而误事。本站只谈姻缘与事业两个主题。`,
      };
    }
  }

  const pool = preferredTopic ? templatesFor(preferredTopic) : TEMPLATES;
  let best: Template | undefined;
  let bestScore = 0;

  for (const t of pool) {
    const score = t.matches.reduce(
      (n, kw) => n + (text.toLowerCase().includes(kw.toLowerCase()) ? kw.length : 0),
      0,
    );
    if (score > bestScore) { bestScore = score; best = t; }
  }

  if (!best) {
    return {
      kind: 'declined',
      reason:
        '没能把这个问题归到姻缘或事业的哪一类。可以直接选下面的题目，' +
        '或把问题问得具体一点。',
    };
  }
  return { kind: 'template', template: best };
}
