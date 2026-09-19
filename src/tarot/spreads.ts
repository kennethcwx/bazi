/**
 * Spreads read through a question.
 *
 * A card means something different asked about love than asked about
 * money, so the 22 major arcana carry a line per topic; the minors are read
 * through their suit, which already says what part of life they are about.
 * Positions come from the topic too — "past / present / future" answers a
 * general question, but "you / them / between you" answers a love one.
 *
 * The synthesis at the end is composed from what is on the table — how many
 * majors, how many reversed, which suit leads — not from the cards' names,
 * so it says something true of *this* spread rather than a horoscope-column
 * sentence that could follow any draw.
 * ponytail: minors read by suit, not per card; add per-card topic lines if
 * a reader finds the minors samey.
 */

import { t, type LocalizedText } from '../i18n/text';
import { SUITS, type Card, type Draw } from './cards';

export type Topic = 'general' | 'love' | 'work' | 'money' | 'decision';
export const TOPICS: readonly Topic[] = ['general', 'love', 'work', 'money', 'decision'];
export const TOPIC_NAME: Record<Topic, LocalizedText> = {
  general: t('综合', 'General'), love: t('爱情', 'Love'), work: t('事业', 'Work'),
  money: t('财运', 'Money'), decision: t('抉择', 'A decision'),
};

export type Size = 1 | 3 | 5;
export const SIZES: readonly Size[] = [1, 3, 5];

/** Position labels by size, with a topic override where the classic layout fits better. */
const POSITIONS: Record<Size, { default: LocalizedText[]; love?: LocalizedText[]; decision?: LocalizedText[] }> = {
  1: { default: [t('指引', 'Guidance')] },
  3: {
    default: [t('过去', 'Past'), t('现在', 'Present'), t('未来', 'Future')],
    love: [t('你', 'You'), t('对方', 'Them'), t('两人之间', 'Between you')],
    decision: [t('现状', 'Where you stand'), t('若选择前进', 'If you go ahead'), t('若选择等待', 'If you wait')],
  },
  5: {
    default: [t('现状', 'Situation'), t('阻碍', 'Obstacle'), t('过去的影响', 'Past influence'), t('建议', 'Advice'), t('结果', 'Outcome')],
    love: [t('你', 'You'), t('对方', 'Them'), t('两人之间', 'Between you'), t('阻碍', 'Obstacle'), t('走向', 'Where it goes')],
  },
};

export const positions = (size: Size, topic: Topic): LocalizedText[] =>
  POSITIONS[size][topic as 'love' | 'decision'] ?? POSITIONS[size].default;

/* ---------- major arcana by topic (upright) ---------- */

type Trio = [love: string, work: string, money: string];
const MAJOR: readonly { zh: Trio; en: Trio }[] = [
  { zh: ['一段关系的起点，带着不设防的新鲜感', '新的开始，先做再学', '别把钱押在还没看清的事上'], en: ['the start of something, open and unguarded', 'a fresh start; do first, learn as you go', "don't stake money on what you haven't looked at"] },
  { zh: ['你有能力把这段感情推向想要的方向', '资源齐备，是动手的时候', '靠自己的本事生财'], en: ['you can steer this where you want it', 'everything you need is on the table; act', 'income from your own skill'] },
  { zh: ['先别说破，感受比言语准', '知道的比说出来的多，先观察', '有隐藏的信息，别急着投'], en: ["don't say it yet; what you sense is truer than what is said", 'you know more than you say; watch first', 'there is hidden information; wait before committing money'] },
  { zh: ['被滋养的感情，安稳而丰盛', '创造与产出的好时候', '丰足，进项稳定'], en: ['a nourishing bond, settled and full', 'a productive stretch; make things', 'plenty; a steady inflow'] },
  { zh: ['稳定但偏理性，关系有规矩', '结构和权威站在你这边', '用纪律管钱，会有成果'], en: ['stable but headed by reason; the bond has rules', 'structure and authority are on your side', 'discipline with money pays off'] },
  { zh: ['走传统的路：承诺、见家人', '按规矩来，找导师', '保守的选择比冒险稳妥'], en: ['the conventional route: commitment, families', 'go by the book; find a mentor', 'the conservative choice beats the gamble'] },
  { zh: ['真正的选择摆在眼前，价值观要对上', '一个合作或去留的抉择', '钱的选择也是价值观的选择'], en: ['a real choice; the values have to match', 'a partnership, or a stay-or-go decision', 'a money choice that is really a values choice'] },
  { zh: ['主动一点，关系会被推动', '靠意志冲过这一段', '把两头拉着的开支收成一头'], en: ['make the move; the bond responds to drive', 'willpower gets you through this stretch', 'pull spending that goes two ways back into one'] },
  { zh: ['温柔比强硬有用', '耐心与自控，别硬碰', '慢慢来，不要急躁地动钱'], en: ['gentleness works where force does not', 'patience and self-command; no head-on fights', 'go slowly; no impulsive money moves'] },
  { zh: ['需要独处想清楚自己要什么', '退一步整理思路', '暂停消费，先盘点'], en: ['you need time alone to know what you want', 'step back and sort out your thinking', 'pause spending and take stock'] },
  { zh: ['转机来了，顺势而为', '一个周期在转，机会随之', '运气在转，但别靠运气'], en: ['a turn is coming; move with it', 'a cycle is turning and an opening comes with it', 'luck is turning; still, do not rely on it'] },
  { zh: ['公平和坦白，关系才站得住', '合同、审核、该来的结果', '账要算清，该得的会得'], en: ['fairness and honesty are what hold this up', 'contracts, reviews, the result that is due', 'settle the accounts; what is owed arrives'] },
  { zh: ['先放下执念，换个角度看对方', '暂停，别硬推', '按兵不动，现在不是动钱的时候'], en: ['let go of the fixed idea and see them anew', 'pause; stop pushing', 'hold still; not the time to move money'] },
  { zh: ['一个阶段结束，才有下一个', '一个章节在结束，让它结束', '一种收入在结束，另找来源'], en: ['one stage must end for the next to begin', 'a chapter is closing; let it', 'one income is ending; find another'] },
  { zh: ['磨合与调和，找到中间的节奏', '平衡与耐心，稳步推进', '收支平衡，别走极端'], en: ['blending and adjusting; find the shared tempo', 'balance and patience; steady progress', 'balance the books; no extremes'] },
  { zh: ['吸引很强，但要看清是不是依赖', '被工作绑住了，看清什么在绑你', '被物欲或债务绑住'], en: ['strong attraction; check whether it is dependence', 'bound to the job; see what binds you', 'bound by wants or by debt'] },
  { zh: ['真相突然揭开，旧的结构塌了', '突变来了，旧的方式撑不住', '突然的损失或开支，重建根基'], en: ['a truth breaks open; the old structure falls', 'upheaval; the old way will not hold', 'a sudden loss or cost; rebuild the base'] },
  { zh: ['受伤后的疗愈，重新相信', '希望回来了，方向清晰', '慢慢恢复，前景向好'], en: ['healing after hurt; trusting again', 'hope is back and the way is clear', 'a slow recovery; the outlook brightens'] },
  { zh: ['看不清对方，别凭想象下结论', '信息模糊，先弄清再决定', '账目不清，别投看不懂的'], en: ["you can't see them clearly; don't conclude from imagination", 'the picture is murky; clarify before deciding', "unclear numbers; don't invest in what you don't understand"] },
  { zh: ['明朗、温暖，值得公开', '成功与认可，放心去做', '好收成，进项明朗'], en: ['clear and warm; worth making public', 'success and recognition; go ahead', 'a good harvest; income clear'] },
  { zh: ['旧关系的召唤，或做出彻底的决定', '一个转折，回应召唤', '清算过去的账，重新开始'], en: ['an old bond calls, or a decisive verdict', 'a turning point; answer the call', 'settle old accounts and begin again'] },
  { zh: ['圆满，一段关系走到完整', '完成，一个项目到达终点', '一轮努力有了完整的回报'], en: ['completion; the bond arrives at wholeness', 'completion; a project reaches its end', 'a full return on a full effort'] },
];

/** The minors: the suit says which part of life, the card says what is happening there. */
const SUIT_FRAME: Record<Topic, Record<keyof typeof SUITS, LocalizedText>> = {
  general: {
    Wands: t('在行动上', 'in what you do'), Cups: t('在感受上', 'in what you feel'),
    Swords: t('在想法上', 'in what you think'), Pentacles: t('在现实层面', 'in practical terms'),
  },
  love: {
    Wands: t('感情的热度', 'the heat of it'), Cups: t('感情本身', 'the feeling itself'),
    Swords: t('两人之间的话', 'the words between you'), Pentacles: t('感情的现实面', 'the practical side of it'),
  },
  work: {
    Wands: t('推进的动力', 'the drive to push it'), Cups: t('与人的关系', 'the people side'),
    Swords: t('判断与沟通', 'judgement and communication'), Pentacles: t('实际的产出', 'the actual output'),
  },
  money: {
    Wands: t('赚钱的冲劲', 'the drive to earn'), Cups: t('对钱的心态', 'your attitude to money'),
    Swords: t('关于钱的决定', 'money decisions'), Pentacles: t('钱本身', 'the money itself'),
  },
  decision: {
    Wands: t('行动的一面', 'the side of action'), Cups: t('心的一面', 'the side of the heart'),
    Swords: t('理性的一面', 'the side of reason'), Pentacles: t('实际的一面', 'the practical side'),
  },
};

const REVERSED_FRAME = t('逆位——受阻、内化或走偏', 'reversed: blocked, turned inward, or off course');

const suitKey = (c: Card): keyof typeof SUITS | null =>
  (Object.keys(SUITS) as (keyof typeof SUITS)[]).find((k) => SUITS[k].name === c.suit) ?? null;

/** What one card says, read through the topic. */
export function meaning(d: Draw, topic: Topic): LocalizedText {
  const c = d.card;
  const kw = d.reversed ? c.reversed : c.upright;
  if (c.arcana === 'major') {
    const idx = topic === 'love' ? 0 : topic === 'work' ? 1 : topic === 'money' ? 2 : null;
    if (idx === null) return kw;
    const m = MAJOR[c.id]!;
    return d.reversed
      ? t(`${m.zh[idx]}；${REVERSED_FRAME.zh}：${c.reversed.zh}`, `${m.en[idx]} — ${REVERSED_FRAME.en}: ${c.reversed.en}`)
      : t(m.zh[idx], m.en[idx]);
  }
  const frame = SUIT_FRAME[topic][suitKey(c)!];
  return d.reversed
    ? t(`${frame.zh}：${kw.zh}（逆位）`, `${frame.en}: ${kw.en} (reversed)`)
    : t(`${frame.zh}：${kw.zh}`, `${frame.en}: ${kw.en}`);
}

export interface SpreadCard {
  readonly draw: Draw;
  readonly position: LocalizedText;
  readonly meaning: LocalizedText;
}

export interface SpreadReading {
  readonly cards: readonly SpreadCard[];
  /** Two or three lines about the spread as a whole. */
  readonly summary: readonly LocalizedText[];
}

export function readSpread(draws: readonly Draw[], topic: Topic): SpreadReading {
  const size = draws.length as Size;
  const pos = positions(size, topic);
  const cards = draws.map((draw, i) => ({ draw, position: pos[i]!, meaning: meaning(draw, topic) }));

  const summary: LocalizedText[] = [];
  const n = draws.length;
  const majors = draws.filter((d) => d.card.arcana === 'major').length;
  const reversed = draws.filter((d) => d.reversed).length;
  if (n > 1) {
    summary.push(majors * 2 >= n
      ? t('大阿卡纳偏多：这件事有它的大势，不全在你手上；顺着走比硬扭省力。',
        'Mostly major arcana: this has a momentum of its own, not all in your hands; going with it costs less than fighting it.')
      : t('小牌为主：这件事在日常的操作里，动手就能改。',
        'Mostly minor cards: this lives in day-to-day handling, and handling can change it.'));
    if (reversed * 2 >= n) summary.push(t('逆位偏多：阻力主要在内部——犹豫、回避或旧模式，不在外面。',
      'Mostly reversed: the resistance is inside — hesitation, avoidance, an old pattern — not out there.'));
    const bySuit = new Map<keyof typeof SUITS, number>();
    for (const d of draws) { const k = suitKey(d.card); if (k) bySuit.set(k, (bySuit.get(k) ?? 0) + 1); }
    const lead = [...bySuit.entries()].sort((a, b) => b[1] - a[1])[0];
    if (lead && lead[1] >= 2) {
      const s = SUITS[lead[0]];
      summary.push(t(`以${s.name.zh}为主：重点在${s.theme.zh}。`, `${s.name.en} lead: the weight is on ${s.theme.en}.`));
    }
  }
  const last = cards[n - 1]!;
  if (n === 5) summary.push(t(`${last.position.zh}落在「${last.draw.card.name.zh}」：${last.meaning.zh}`, `${last.position.en}: ${last.draw.card.name.en} — ${last.meaning.en}`));
  if (n === 1) summary.push(d1(last));
  return { cards, summary };
}

const d1 = (c: SpreadCard): LocalizedText =>
  c.draw.reversed
    ? t('单张逆位：答案是「还没到」或「先处理自己这边」。', 'One card, reversed: the answer is "not yet", or "your side first".')
    : t('单张正位：答案是清楚的，照牌面做。', 'One card, upright: the answer is plain; do what the card says.');

