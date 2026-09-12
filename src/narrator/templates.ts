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
import { t, type LocalizedText } from '../i18n/text';

export interface Template {
  readonly id: string;
  readonly topic: Exclude<Topic, 'base'>;
  /** What the user sees on the button. */
  readonly question: LocalizedText;
  /** One line of context under it. */
  readonly hint: LocalizedText;
  /**
   * Finding ids this template leans on, most important first. Findings not
   * listed are still supplied as background — the ordering tells the narrator
   * what to lead with, it does not restrict what it may cite.
   */
  readonly leadWith: readonly string[];
  /** How many findings beyond `leadWith` the composer may add as background.
   *  Unset means the default (up to two, more when the lead is thin); 0 means
   *  the lead findings are the whole answer. */
  readonly background?: number;
  /** What this answer is for. Goes into the prompt verbatim. */
  readonly focus: LocalizedText;
  /** Rough length target: Chinese characters, or English words. */
  readonly targetLength: number;
  /** Keywords that route free text here, in either language. */
  readonly matches: readonly string[];
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'rel.overview',
    topic: 'relationship',
    question: t('我的感情大概是什么格局？', 'What shape do my relationships take?'),
    hint: t('夫妻宫、配偶星与整体走向', 'Spouse Palace, spouse star, and the overall picture'),
    leadWith: ['rel.palace.content', 'rel.star.absent', 'rel.star.hidden', 'rel.star.exposed', 'rel.star.favourable', 'rel.star.unfavourable'],
    focus: t(
      '先讲这个命局在感情上的基本盘：夫妻宫坐什么、配偶星在不在、婚姻对本人是助力还是负担。' +
        '收尾给一句这个人在感情里最需要留意的事。',
      'Start with the basics of this chart in love: what sits in the Spouse Palace, ' +
        'whether the spouse star is present, and whether marriage helps or costs ' +
        'this person. Close with the one thing they most need to watch.',
    ),
    targetLength: 420,
    matches: ['感情', '姻缘', '婚姻', '爱情', '桃花', '恋爱', '婚', 'relationship', 'love', 'marriage', 'romantic', 'dating'],
  },
  {
    id: 'rel.timing',
    topic: 'relationship',
    question: t('什么时候比较容易成家？', 'When am I most likely to marry?'),
    hint: t('大运流年引动夫妻宫的年份', 'Years when the luck cycles stir the Spouse Palace'),
    leadWith: ['rel.timing.favourable', 'rel.timing.volatile', 'rel.palace.disturbed', 'rel.palace.stable'],
    focus: t(
      '讲婚缘的时机。若结论是"某个地支年反复引动"，要说清楚这是命局结构使然、约十二年一轮，' +
        '不是某一年独有的机缘——不要把结构性的规律写成四次独立的预言。' +
        '冲夫妻宫的年份主"变"，方向要看当时处境，不要替人断定是聚是散。',
      'Cover the timing of marriage. If the finding is that one branch keeps ' +
        'recurring, say plainly that this is structural and comes round about ' +
        'every twelve years — do not present a recurring pattern as four separate ' +
        'predictions. A clash to the Spouse Palace means change, not a direction; ' +
        'do not decide for them whether it means coming together or coming apart.',
    ),
    targetLength: 400,
    matches: ['什么时候', '何时', '几岁', '哪一年', '哪年', '结婚', '成家', '脱单', 'when', 'timing', 'marry', 'married', 'year'],
  },
  {
    id: 'rel.partner',
    topic: 'relationship',
    question: t('我的另一半可能是什么样的人？', 'What might my partner be like?'),
    hint: t('由夫妻宫与配偶星的性质推', 'Read from the Spouse Palace and the spouse star'),
    leadWith: ['rel.palace.content', 'rel.star.exposed', 'rel.star.hidden', 'rel.shensha'],
    focus: t(
      '从夫妻宫本气的十神性质、配偶星的透藏与强弱，讲配偶大致的性情与两人的相处基调。' +
        '这一题最容易写成空话——务必扣住十神的具体含义，不要写放诸四海皆准的形容词。' +
        '不要描述外貌、职业或家世，命理不支持这种精度。',
      'From the Ten God governing the Spouse Palace and whether the spouse star ' +
        'is visible or hidden, describe the likely temperament of the partner and ' +
        'the tone of the relationship. This question invites empty flattery — stay ' +
        'anchored to what the specific Ten God actually means and avoid adjectives ' +
        'that would fit anyone. Do not describe appearance, occupation or family ' +
        'background; the method does not support that precision.',
    ),
    targetLength: 380,
    matches: ['另一半', '配偶', '对象', '什么样的人', '怎样的人', '老公', '老婆', '伴侣', 'partner', 'spouse', 'husband', 'wife', 'who'],
  },
  {
    id: 'rel.obstacles',
    topic: 'relationship',
    question: t('为什么我的感情总是反复？', 'Why do my relationships keep repeating?'),
    hint: t('刑冲害破、比劫夺财、官杀混杂等', 'Clashes, rivals, and mixed authority stars'),
    leadWith: ['rel.palace.disturbed', 'rel.male.competition', 'rel.female.mixed', 'rel.female.hurting-officer', 'rel.star.unfavourable'],
    focus: t(
      '讲这个命局在感情上的结构性难处，以及可以怎么应对。' +
        '若原局夫妻宫其实安稳、问题多来自大运流年，就要如实说明，不要为了回应问题而制造问题。' +
        '语气要像一个见过很多命的人在讲道理，不是在下判决。',
      'Cover the structural difficulties this chart has in relationships, and what ' +
        'can be done about them. If the natal Spouse Palace is in fact sound and ' +
        'the trouble comes from the luck cycles, say so — do not manufacture a ' +
        'problem to match the question. Speak like someone who has read many ' +
        'charts and is explaining, not passing sentence.',
    ),
    targetLength: 400,
    matches: ['为什么', '不顺', '反复', '分手', '波折', '离婚', '吵架', '第三者', 'why', 'breakup', 'problem', 'fail', 'divorce', 'fight'],
  },

  {
    id: 'career.overview',
    topic: 'career',
    question: t('我的事业格局如何？', 'What shape does my working life take?'),
    hint: t('格局、十神偏向与整体走势', 'Structure, dominant force, and overall direction'),
    leadWith: ['career.structure', 'career.dominant', 'career.lean'],
    focus: t(
      '先讲格局与十神的偏向说明这个人做事的方式，再讲这决定了什么样的路走得顺。' +
        '格神透不透、成格破格，要讲清楚它对"方向是否清晰"的影响。',
      'Start with the structure and the dominant Ten God to describe how this ' +
        'person works, then say what kind of path that makes easier. Whether the ' +
        'governing stem is exposed matters for how clear their direction is — ' +
        'make that connection explicit.',
    ),
    targetLength: 420,
    matches: ['事业', '工作', '格局', '前途', '发展', 'career', 'work', 'professional', 'future'],
  },
  {
    id: 'career.field',
    topic: 'career',
    question: t('我适合什么行业？', 'What field suits me?'),
    hint: t('由用神五行推行业与方位', 'Sectors and directions from the favourable element'),
    leadWith: ['career.industry', 'career.dominant', 'career.structure'],
    focus: t(
      '由用神五行讲行业方向与有利方位。给出的行业要具体可用，并说明为什么是这几类。' +
        '若调候与扶抑取用不一致，要说明两条路都有道理、行业上可以兼顾——这是流派差异，不是模棱两可。',
      'From the favourable element, give sector direction and a favourable ' +
        'geographic direction. Keep the sectors concrete and usable, and say why ' +
        'those and not others. If climate and strength disagree on the favourable ' +
        'element, explain that both readings are defensible and a sector spanning ' +
        'the two is reasonable — this is a difference of method, not hedging.',
    ),
    targetLength: 380,
    matches: ['行业', '职业', '做什么', '方向', '哪一行', '哪行', '哪个行业', '适合做', 'industry', 'field', 'job', 'sector', 'line of work'],
  },
  {
    id: 'career.mode',
    topic: 'career',
    question: t('我适合上班还是自己做？', 'Employment or working for myself?'),
    hint: t('身强弱与官印食伤财的配置', 'Day Master strength against authority, resource and output'),
    leadWith: ['career.lean', 'career.dominant', 'career.structure'],
    focus: t(
      '正面回答受雇或自营，并讲清楚判断的依据（身强弱、官印是否得力、食伤财是否成局）。' +
        '若结论是"两可"，就要说明在什么条件下适合哪一种，而不是含糊带过。',
      'Answer the question directly — employment or self-employment — and set out ' +
        'what the judgement rests on: Day Master strength, whether authority and ' +
        'resource carry weight, whether output and wealth form a working pair. If ' +
        'the answer is genuinely "either", say under what conditions each one ' +
        'works rather than leaving it vague.',
    ),
    targetLength: 360,
    matches: ['创业', '上班', '打工', '自己做', '受雇', 'employed', 'business', 'startup', 'own'],
  },
  {
    id: 'career.timing',
    topic: 'career',
    question: t('哪一段大运对事业最有利？', 'Which decade is strongest for my career?'),
    hint: t('十步大运的用神得失', 'Ten luck pillars scored against the favourable element'),
    // career.timing.none is deliberately absent: ten consecutive decades cover
    // all ten stems, so at least two always carry a favourable stem and the
    // no-good-decade branch effectively never fires. It is still supplied as
    // background if it ever does.
    leadWith: ['career.timing.favourable', 'career.timing.mild', 'career.timing.adverse'],
    focus: t(
      '讲大运的起落，点出最得力与最需留意的阶段，并说明该怎么用。' +
        '若十步运里没有干支俱为用神的强运，要如实说事业靠积累多于际遇——这比编一个旺运有用。' +
        '不利的运讲成"不宜扩张"，不要讲成灾祸。',
      'Cover how the luck pillars rise and fall, name the strongest and the one ' +
        'to be careful in, and say what to do with each. If no pillar has both ' +
        'stem and branch favourable, say plainly that progress comes from ' +
        'accumulation rather than a break — that is more use than inventing a ' +
        'golden decade. Frame a difficult pillar as "not the time to expand", ' +
        'never as disaster.',
    ),
    targetLength: 400,
    matches: ['大运', '什么时候', '哪一年', '运势', 'decade', 'luck', 'when', 'period'],
  },
];

export const templateById = (id: string): Template | undefined =>
  TEMPLATES.find((t2) => t2.id === id);

export const templatesFor = (topic: Exclude<Topic, 'base'>): Template[] =>
  TEMPLATES.filter((t2) => t2.topic === topic);

/** Questions we decline on principle — and which keep us out of trouble. */
const OUT_OF_SCOPE: readonly (readonly [RegExp, LocalizedText])[] = [
  [
    /病|癌|健康|寿命|生死|几时死|活到|自杀|\b(illness|disease|cancer|health|die|death|lifespan|live to|suicide)\b/i,
    t('健康与寿命', 'health and lifespan'),
  ],
  [
    /官司|坐牢|判刑|违法|法律|\b(lawsuit|court|jail|prison|sue|legal|convict)\b/i,
    t('法律', 'legal matters'),
  ],
  [
    /股票|彩票|赌|号码|买什么币|投资什么|\b(stock|lottery|gambl|bet|crypto|which coin|what to invest)\b/i,
    t('博彩与具体投资标的', 'gambling and specific investments'),
  ],
];

export type RouteResult =
  | { readonly kind: 'template'; readonly template: Template }
  | { readonly kind: 'declined'; readonly reason: LocalizedText };

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
        reason: t(
          `本站不回答${subject.zh}相关的问题。八字在这些事情上给不出可靠答案，` +
            `只谈姻缘与事业两个主题。`,
          `This site does not answer questions about ${subject.en}. BaZi has no ` +
            `reliable answer there. It covers relationships and career only.`,
        ),
      };
    }
  }

  const pool = preferredTopic ? templatesFor(preferredTopic) : TEMPLATES;
  let best: Template | undefined;
  let bestScore = 0;

  for (const tpl of pool) {
    const score = tpl.matches.reduce(
      (n, kw) => n + (text.toLowerCase().includes(kw.toLowerCase()) ? kw.length : 0),
      0,
    );
    if (score > bestScore) { bestScore = score; best = tpl; }
  }

  if (!best) {
    return {
      kind: 'declined',
      reason: t(
        '没能把这个问题归到姻缘或事业的哪一类。可以直接选下面的题目，或把问题问得具体一点。',
        'That question does not clearly fall under relationships or career. Pick ' +
          'one of the questions below, or ask something more specific.',
      ),
    };
  }
  return { kind: 'template', template: best };
}
