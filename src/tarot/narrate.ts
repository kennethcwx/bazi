/**
 * The tarot narrator: answer the question with the cards that were drawn.
 *
 * Tables can say what a card means; they cannot know what "should I take the
 * job" is asking. This is the one place in the app where a model is doing
 * more than rephrasing — it has to relate each card, in its position, to the
 * question as worded. It is still fenced: it may only speak about the cards
 * on the table, reversed as reversed, and it is told to answer first and
 * explain second. With no key configured there is no narrator; the page
 * shows the table meanings and says so.
 */

import type { Locale } from '../i18n/text';
import { selectProvider } from '../narrator/providers';
import { TOPIC_NAME, type SpreadReading, type Topic } from './spreads';

const SYSTEM_ZH = `你是一位塔罗解读者。来访者带着一个具体的问题抽了牌；程序已经给出每张牌的位置和基本牌义。

你的工作是**直接回答这个问题**：把每张牌放在它的位置上、对着问题本身来讲，而不是背牌义。

规则：
1. 只讲抽到的牌。不得提到没抽到的牌，不得改动正逆位。
2. 逆位按逆位讲：受阻、内化或走偏，不是简单的相反。
3. 结构：先用一两句话给出对问题的整体答案；再按位置逐张讲，每张两到三句，说明它对这个问题意味着什么；最后一句是可以去做的建议。
4. 语气平实、具体，避免绝对化的预言——用「倾向」「更可能」「要看」。不谈健康、法律、投资操作。
5. 来访者没写问题时，按主题回答。
6. 全文 220–320 字。直接开始，不要标题，不要重复问题。`;

const SYSTEM_EN = `You are a tarot reader. The querent has drawn cards for a specific question; each card's position and base meaning are supplied.

Your job is to **answer the question directly**: place each card in its position and read it against the question as worded, rather than reciting card meanings.

Rules:
1. Speak only of the cards drawn. Never mention a card that is not on the table; never change upright/reversed.
2. Read reversed cards as reversed: blocked, turned inward or off course — not simply the opposite.
3. Structure: one or two sentences answering the question overall; then each card by position, two or three sentences on what it means for this question; then one sentence of advice that can be acted on.
4. Plain and concrete. No absolute predictions — "leans", "more likely", "depends on". No health, legal or investment instructions.
5. With no question given, answer for the topic.
6. 170–240 words. Start directly: no title, do not restate the question.`;

export function tarotUserMessage(
  question: string, topic: Topic, spread: SpreadReading, locale: Locale,
): string {
  const zh = locale === 'zh';
  const cards = spread.cards.map((c, i) => {
    const name = c.draw.card.name[locale];
    const orient = c.draw.reversed ? (zh ? '逆位' : 'reversed') : (zh ? '正位' : 'upright');
    const kw = (c.draw.reversed ? c.draw.card.reversed : c.draw.card.upright)[locale];
    return zh
      ? `${i + 1}. 位置「${c.position.zh}」：${name}（${orient}）——牌义：${kw}；就此主题：${c.meaning.zh}`
      : `${i + 1}. Position "${c.position.en}": ${name} (${orient}) — keywords: ${kw}; for this topic: ${c.meaning.en}`;
  }).join('\n');
  return zh
    ? `问题：${question || '（未写，按主题回答）'}\n主题：${TOPIC_NAME[topic].zh}\n牌阵（${spread.cards.length} 张）：\n${cards}`
    : `Question: ${question || '(none given; answer for the topic)'}\nTopic: ${TOPIC_NAME[topic].en}\nSpread (${spread.cards.length} cards):\n${cards}`;
}

/** Stream a reading, or return null when no model is configured. */
export async function narrateTarot(
  question: string, topic: Topic, spread: SpreadReading, locale: Locale,
  onDelta: (t: string) => void,
): Promise<{ text: string; source: string } | null> {
  const provider = selectProvider();
  if (!provider) return null;
  const r = await provider.stream(
    locale === 'zh' ? SYSTEM_ZH : SYSTEM_EN,
    tarotUserMessage(question, topic, spread, locale),
    onDelta,
  );
  return { text: r.text, source: provider.id };
}
