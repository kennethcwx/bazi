/**
 * The 78-card Rider–Waite deck with bilingual names and keyword meanings.
 * Keywords, not essays: a draw is read as name + a phrase, and a reversed
 * card gets its own phrase rather than "the opposite" — reversals are
 * usually a blocked or inward form, not a negation.
 */

import { t, type LocalizedText } from '../i18n/text';

export interface Card {
  readonly id: number;
  readonly name: LocalizedText;
  readonly arcana: 'major' | 'minor';
  readonly suit: LocalizedText | null;
  readonly upright: LocalizedText;
  readonly reversed: LocalizedText;
}

const c = (
  id: number, zh: string, en: string, suit: LocalizedText | null,
  upZh: string, upEn: string, revZh: string, revEn: string,
): Card => ({
  id, name: t(zh, en), arcana: suit ? 'minor' : 'major', suit,
  upright: t(upZh, upEn), reversed: t(revZh, revEn),
});

export const SUITS = {
  Wands: { name: t('权杖', 'Wands'), theme: t('行动、热情、意志', 'action, passion, will') },
  Cups: { name: t('圣杯', 'Cups'), theme: t('情感、关系、直觉', 'feeling, relationship, intuition') },
  Swords: { name: t('宝剑', 'Swords'), theme: t('思想、冲突、真相', 'thought, conflict, truth') },
  Pentacles: { name: t('星币', 'Pentacles'), theme: t('物质、工作、身体', 'material, work, body') },
} as const;

export const DECK: readonly Card[] = [
  c(0, '愚者', 'The Fool', null, '新的开始、天真、冒险', 'new beginnings, innocence, a leap', '鲁莽、犹豫、错过时机', 'recklessness, hesitation, a missed jump'),
  c(1, '魔术师', 'The Magician', null, '资源齐备、行动力、心想事成', 'resourcefulness, will, making it happen', '空谈、操纵、才能被浪费', 'talk without action, manipulation, wasted talent'),
  c(2, '女祭司', 'The High Priestess', null, '直觉、内在智慧、静待', 'intuition, inner knowing, waiting', '忽视直觉、秘密、表面功夫', 'ignored intuition, secrets, surface only'),
  c(3, '皇后', 'The Empress', null, '丰饶、滋养、创造', 'abundance, nurturing, creation', '依赖、窒息的照顾、创意受阻', 'dependence, smothering, blocked creativity'),
  c(4, '皇帝', 'The Emperor', null, '秩序、掌控、稳固', 'structure, authority, stability', '僵硬、控制欲、软弱的领导', 'rigidity, domination, weak leadership'),
  c(5, '教皇', 'The Hierophant', null, '传统、指引、体制', 'tradition, guidance, institutions', '反叛、教条、另辟蹊径', 'rebellion, dogma, an unconventional path'),
  c(6, '恋人', 'The Lovers', null, '结合、选择、价值一致', 'union, choice, aligned values', '失衡、价值冲突、错误选择', 'imbalance, clashing values, a poor choice'),
  c(7, '战车', 'The Chariot', null, '意志、前进、克服阻力', 'willpower, momentum, overcoming', '失控、方向不明、硬闯', 'loss of control, no direction, forcing it'),
  c(8, '力量', 'Strength', null, '柔性的勇气、耐心、自控', 'quiet courage, patience, self-command', '自我怀疑、软弱、失控的冲动', 'self-doubt, weakness, raw impulse'),
  c(9, '隐士', 'The Hermit', null, '独处、内省、寻找答案', 'solitude, reflection, seeking', '孤立、逃避、拒绝忠告', 'isolation, withdrawal, refusing counsel'),
  c(10, '命运之轮', 'Wheel of Fortune', null, '转机、周期、运气', 'a turn of fortune, cycles, luck', '逆境、抗拒变化、坏运', 'a downturn, resisting change, bad luck'),
  c(11, '正义', 'Justice', null, '公平、真相、因果', 'fairness, truth, cause and effect', '不公、逃避责任、失衡', 'unfairness, dodging accountability, imbalance'),
  c(12, '倒吊人', 'The Hanged Man', null, '暂停、放手、换个角度', 'pause, surrender, a new angle', '拖延、无谓的牺牲、卡住', 'stalling, pointless sacrifice, stuck'),
  c(13, '死神', 'Death', null, '结束、转化、放下', 'endings, transformation, release', '抗拒结束、停滞、拖着不放', 'resisting the end, stagnation, clinging'),
  c(14, '节制', 'Temperance', null, '平衡、耐心、调和', 'balance, patience, blending', '过度、失衡、急躁', 'excess, imbalance, impatience'),
  c(15, '恶魔', 'The Devil', null, '束缚、执念、物欲', 'bondage, obsession, attachment', '挣脱、觉醒、收回力量', 'breaking free, awakening, reclaiming power'),
  c(16, '高塔', 'The Tower', null, '突变、崩塌、真相揭露', 'upheaval, collapse, revelation', '避过一劫、恐惧改变、迟来的崩塌', 'a near miss, fear of change, a delayed fall'),
  c(17, '星星', 'The Star', null, '希望、疗愈、信心', 'hope, healing, faith', '失望、缺乏信心、疲惫', 'despair, lost faith, depletion'),
  c(18, '月亮', 'The Moon', null, '幻象、不安、潜意识', 'illusion, anxiety, the unconscious', '迷雾散去、真相显现、恐惧释放', 'fog lifting, clarity, fear released'),
  c(19, '太阳', 'The Sun', null, '喜悦、成功、活力', 'joy, success, vitality', '短暂的阴霾、过度乐观、被遮蔽', 'a passing cloud, over-optimism, dimmed'),
  c(20, '审判', 'Judgement', null, '觉醒、召唤、清算', 'awakening, a calling, reckoning', '自我怀疑、逃避召唤、严苛自责', 'self-doubt, ignoring the call, harsh self-judgement'),
  c(21, '世界', 'The World', null, '完成、圆满、整合', 'completion, wholeness, integration', '未完成、差最后一步、封闭', 'incomplete, one step short, closure withheld'),
  c(22, '权杖一', 'Ace of Wands', SUITS.Wands.name, '新的动力、灵感', 'a spark, inspiration', '延误、缺乏动力', 'delay, no drive'),
  c(23, '权杖二', 'Two of Wands', SUITS.Wands.name, '规划、抉择、放眼未来', 'planning, a choice, looking ahead', '害怕未知、原地不动', 'fear of the unknown, staying put'),
  c(24, '权杖三', 'Three of Wands', SUITS.Wands.name, '拓展、等待成果', 'expansion, results on the way', '受阻、计划落空', 'setbacks, plans falling through'),
  c(25, '权杖四', 'Four of Wands', SUITS.Wands.name, '庆祝、稳固、归属', 'celebration, stability, belonging', '家中不和、过渡期', 'discord at home, transition'),
  c(26, '权杖五', 'Five of Wands', SUITS.Wands.name, '竞争、摩擦、意见不合', 'competition, friction, disagreement', '避开冲突、和解', 'avoiding conflict, resolution'),
  c(27, '权杖六', 'Six of Wands', SUITS.Wands.name, '胜利、认可', 'victory, recognition', '自大、缺乏认可', 'ego, lack of recognition'),
  c(28, '权杖七', 'Seven of Wands', SUITS.Wands.name, '坚守立场、迎战', 'holding your ground', '被压倒、退让', 'overwhelmed, giving way'),
  c(29, '权杖八', 'Eight of Wands', SUITS.Wands.name, '快速推进、消息', 'swift movement, news', '拖延、混乱', 'delays, chaos'),
  c(30, '权杖九', 'Nine of Wands', SUITS.Wands.name, '坚持、最后一关', 'persistence, the last push', '疲惫、防御心', 'exhaustion, defensiveness'),
  c(31, '权杖十', 'Ten of Wands', SUITS.Wands.name, '负担、责任过重', 'burden, overload', '放下重担、委托', 'putting it down, delegating'),
  c(32, '权杖侍从', 'Page of Wands', SUITS.Wands.name, '好奇、探索、消息', 'curiosity, exploration, news', '三分钟热度', 'a fizzled start'),
  c(33, '权杖骑士', 'Knight of Wands', SUITS.Wands.name, '冲动、冒险、行动', 'impulse, adventure, action', '鲁莽、受挫', 'haste, frustration'),
  c(34, '权杖王后', 'Queen of Wands', SUITS.Wands.name, '自信、热情、独立', 'confidence, warmth, independence', '苛刻、嫉妒', 'demanding, jealous'),
  c(35, '权杖国王', 'King of Wands', SUITS.Wands.name, '远见、领导', 'vision, leadership', '专横、高期望', 'domineering, high-handed'),
  c(36, '圣杯一', 'Ace of Cups', SUITS.Cups.name, '新的感情、心的打开', 'new feeling, an open heart', '压抑情感、空虚', 'repressed feeling, emptiness'),
  c(37, '圣杯二', 'Two of Cups', SUITS.Cups.name, '结合、相互吸引', 'union, mutual attraction', '失衡、分歧', 'imbalance, discord'),
  c(38, '圣杯三', 'Three of Cups', SUITS.Cups.name, '友谊、庆祝', 'friendship, celebration', '过度、三角关系', 'excess, a third party'),
  c(39, '圣杯四', 'Four of Cups', SUITS.Cups.name, '冷漠、错过眼前', 'apathy, missing what is offered', '重新投入', 're-engagement'),
  c(40, '圣杯五', 'Five of Cups', SUITS.Cups.name, '失落、悔恨', 'loss, regret', '接受、走出来', 'acceptance, moving on'),
  c(41, '圣杯六', 'Six of Cups', SUITS.Cups.name, '回忆、纯真、旧人', 'nostalgia, innocence, someone from the past', '困在过去', 'stuck in the past'),
  c(42, '圣杯七', 'Seven of Cups', SUITS.Cups.name, '幻想、选择太多', 'fantasy, too many options', '看清现实、做决定', 'clarity, deciding'),
  c(43, '圣杯八', 'Eight of Cups', SUITS.Cups.name, '离开、寻找更多', 'walking away, seeking more', '害怕改变、徘徊', 'fear of change, drifting'),
  c(44, '圣杯九', 'Nine of Cups', SUITS.Cups.name, '满足、愿望成真', 'contentment, a wish granted', '自满、表面的快乐', 'smugness, hollow pleasure'),
  c(45, '圣杯十', 'Ten of Cups', SUITS.Cups.name, '圆满、家庭和谐', 'fulfilment, harmony at home', '家庭失和、破碎的理想', 'broken harmony, shattered ideal'),
  c(46, '圣杯侍从', 'Page of Cups', SUITS.Cups.name, '创意、感性的消息', 'creative spark, emotional news', '情绪不成熟', 'emotional immaturity'),
  c(47, '圣杯骑士', 'Knight of Cups', SUITS.Cups.name, '浪漫、追求', 'romance, pursuit', '不切实际、情绪化', 'unrealistic, moody'),
  c(48, '圣杯王后', 'Queen of Cups', SUITS.Cups.name, '同理、直觉、关怀', 'compassion, intuition, care', '情绪泛滥、依赖', 'emotional overflow, dependence'),
  c(49, '圣杯国王', 'King of Cups', SUITS.Cups.name, '情绪成熟、平衡', 'emotional maturity, balance', '操控、情绪压抑', 'manipulation, repressed feeling'),
  c(50, '宝剑一', 'Ace of Swords', SUITS.Swords.name, '清晰、突破、真相', 'clarity, breakthrough, truth', '混乱、错误判断', 'confusion, poor judgement'),
  c(51, '宝剑二', 'Two of Swords', SUITS.Swords.name, '僵局、回避决定', 'stalemate, avoiding a decision', '僵局打破、信息涌入', 'stalemate broken, information flooding in'),
  c(52, '宝剑三', 'Three of Swords', SUITS.Swords.name, '心碎、痛苦的真相', 'heartbreak, painful truth', '疗愈、释怀', 'healing, release'),
  c(53, '宝剑四', 'Four of Swords', SUITS.Swords.name, '休息、恢复', 'rest, recovery', '倦怠、被迫停下', 'burnout, forced stop'),
  c(54, '宝剑五', 'Five of Swords', SUITS.Swords.name, '冲突、代价惨重的胜利', 'conflict, a hollow win', '和解、放下争执', 'reconciliation, letting go'),
  c(55, '宝剑六', 'Six of Swords', SUITS.Swords.name, '过渡、离开困境', 'transition, leaving trouble behind', '难以前进、包袱', 'unable to move on, baggage'),
  c(56, '宝剑七', 'Seven of Swords', SUITS.Swords.name, '策略、隐瞒', 'strategy, deception', '坦白、良心', 'confession, conscience'),
  c(57, '宝剑八', 'Eight of Swords', SUITS.Swords.name, '受困、自我设限', 'restriction, self-imposed limits', '解脱、新视角', 'release, a new view'),
  c(58, '宝剑九', 'Nine of Swords', SUITS.Swords.name, '焦虑、失眠、恐惧', 'anxiety, sleeplessness, dread', '恐惧消退、寻求帮助', 'fear easing, reaching out'),
  c(59, '宝剑十', 'Ten of Swords', SUITS.Swords.name, '结束、谷底', 'an ending, rock bottom', '复原、最坏已过', 'recovery, the worst is over'),
  c(60, '宝剑侍从', 'Page of Swords', SUITS.Swords.name, '好奇、警觉、新想法', 'curiosity, vigilance, new ideas', '轻率、闲言', 'hastiness, gossip'),
  c(61, '宝剑骑士', 'Knight of Swords', SUITS.Swords.name, '直冲、果断', 'charging ahead, decisiveness', '鲁莽、缺乏方向', 'recklessness, no direction'),
  c(62, '宝剑王后', 'Queen of Swords', SUITS.Swords.name, '清醒、直言', 'clear-eyed, candid', '冷酷、尖刻', 'cold, cutting'),
  c(63, '宝剑国王', 'King of Swords', SUITS.Swords.name, '理性、权威、真相', 'reason, authority, truth', '滥权、操控', 'abuse of power, manipulation'),
  c(64, '星币一', 'Ace of Pentacles', SUITS.Pentacles.name, '新的机会、财运', 'new opportunity, prosperity', '错失机会、贪心', 'a lost opportunity, greed'),
  c(65, '星币二', 'Two of Pentacles', SUITS.Pentacles.name, '平衡、多头兼顾', 'juggling, adaptability', '失衡、手忙脚乱', 'overextended, dropping things'),
  c(66, '星币三', 'Three of Pentacles', SUITS.Pentacles.name, '合作、手艺', 'teamwork, craft', '缺乏合作、敷衍', 'poor teamwork, sloppy work'),
  c(67, '星币四', 'Four of Pentacles', SUITS.Pentacles.name, '守成、控制、吝啬', 'holding on, control, hoarding', '放手、慷慨', 'letting go, generosity'),
  c(68, '星币五', 'Five of Pentacles', SUITS.Pentacles.name, '匮乏、被遗弃', 'hardship, feeling left out', '复原、找到支持', 'recovery, finding support'),
  c(69, '星币六', 'Six of Pentacles', SUITS.Pentacles.name, '慷慨、施与受', 'generosity, giving and receiving', '债务、不平等', 'debt, strings attached'),
  c(70, '星币七', 'Seven of Pentacles', SUITS.Pentacles.name, '耐心、评估收成', 'patience, assessing the harvest', '缺乏耐心、投入无果', 'impatience, poor return'),
  c(71, '星币八', 'Eight of Pentacles', SUITS.Pentacles.name, '专注、精进', 'diligence, mastery in progress', '敷衍、完美主义', 'cutting corners, perfectionism'),
  c(72, '星币九', 'Nine of Pentacles', SUITS.Pentacles.name, '独立、自足、享受成果', 'independence, self-sufficiency, enjoying it', '过度工作、财务依赖', 'overwork, financial dependence'),
  c(73, '星币十', 'Ten of Pentacles', SUITS.Pentacles.name, '传承、长期安稳', 'legacy, lasting security', '家族纠纷、财务风险', 'family disputes, financial risk'),
  c(74, '星币侍从', 'Page of Pentacles', SUITS.Pentacles.name, '新的学习、务实的开始', 'a new skill, a practical start', '拖延、缺乏进展', 'procrastination, no progress'),
  c(75, '星币骑士', 'Knight of Pentacles', SUITS.Pentacles.name, '稳扎稳打、可靠', 'steady effort, reliability', '停滞、无聊', 'stagnation, boredom'),
  c(76, '星币王后', 'Queen of Pentacles', SUITS.Pentacles.name, '务实的关怀、富足', 'practical care, abundance', '工作与家庭失衡', 'work-life imbalance'),
  c(77, '星币国王', 'King of Pentacles', SUITS.Pentacles.name, '成就、稳定、富有', 'achievement, stability, wealth', '贪婪、固执', 'greed, stubbornness'),
];

export interface Draw {
  readonly card: Card;
  readonly reversed: boolean;
}

/** A small deterministic PRNG (mulberry32) so the daily card is stable for a day. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Draw `n` distinct cards. `seed` makes it repeatable; omit it for a fresh spread. */
export function draw(n: number, seed?: string): Draw[] {
  const rnd = seed === undefined
    ? () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296
    : mulberry32(hash(seed));
  const ids = DECK.map((_, i) => i);
  const out: Draw[] = [];
  for (let k = 0; k < n; k++) {
    const j = k + Math.floor(rnd() * (ids.length - k));
    [ids[k], ids[j]] = [ids[j]!, ids[k]!];
    out.push({ card: DECK[ids[k]!]!, reversed: rnd() < 0.5 });
  }
  return out;
}

/** The card of the day: the same for one person for one day, then a new one. */
export const dailyCard = (personKey: string, isoDate: string): Draw =>
  draw(1, `${personKey}|${isoDate}`)[0]!;
