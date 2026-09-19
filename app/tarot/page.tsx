'use client';

/**
 * 塔罗 — a card for the day and a three-card spread.
 *
 * The daily card is seeded from the date and the remembered birth date (or a
 * per-device key when nothing is remembered), so it stays the same all day
 * and changes at midnight — drawing it twice must not give a second answer.
 * The spread is genuinely random, because a spread is a question asked now.
 */

import { useEffect, useState } from 'react';
import Nav from '../Nav';
import { LangSwitch, useLocale } from '../useLocale';
import { dailyCard, draw, type Draw } from '../../src/tarot/cards';
import { readSpread, SIZES, TOPIC_NAME, TOPICS, type Size, type SpreadReading, type Topic } from '../../src/tarot/spreads';
import { loadSelf } from '../../src/storage';
import { t } from '../../src/i18n/text';

const S = {
  title: t('塔罗', 'Tarot'),
  tagline: t('每日一牌；再带着一个问题抽一、三或五张。', 'A card for the day, then one, three or five cards for a question.'),
  daily: t('今日牌', 'Card of the day'),
  spread: t('问牌', 'Ask the cards'),
  topicLabel: t('问什么', 'About'),
  sizeLabel: t('抽几张', 'How many'),
  question: t('你的问题（可留空）', 'Your question (optional)'),
  questionPh: t('例如：这份工作该不该接？', 'e.g. Should I take the job?'),
  drawBtn: t('抽牌', 'Draw'),
  redraw: t('重抽', 'Draw again'),
  youAsked: t('你问', 'You asked'),
  overall: t('整体', 'Overall'),
  cardWord: t('张', ''),
  reversed: t('逆位', 'Reversed'),
  upright: t('正位', 'Upright'),
  hint: t('抽牌前先在心里定一个问题。', 'Hold one question in mind before you draw.'),
};

function personKey(): string {
  const mine = loadSelf();
  if (mine) return mine.date;
  try {
    let k = window.localStorage.getItem('tarot_key');
    if (!k) { k = String(Math.random()); window.localStorage.setItem('tarot_key', k); }
    return k;
  } catch { return 'anon'; }
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function CardFace({ d, L, position, meaning: m }: { d: Draw; L: 'zh' | 'en'; position?: string; meaning?: string }) {
  const meaning = m ?? (d.reversed ? d.card.reversed : d.card.upright)[L];
  return (
    <div className={`tarot-card${d.reversed ? ' is-reversed' : ''}`}>
      {position && <div className="tarot-pos">{position}</div>}
      <div className="tarot-name">{d.card.name[L]}</div>
      <div className="tarot-orient">{d.reversed ? S.reversed[L] : S.upright[L]}{d.card.suit && ` · ${d.card.suit[L]}`}</div>
      <p className="tarot-meaning">{meaning}</p>
    </div>
  );
}

export default function Tarot() {
  const [L, setLocale] = useLocale();
  const [daily, setDaily] = useState<Draw | null>(null);
  const [topic, setTopic] = useState<Topic>('general');
  const [size, setSize] = useState<Size>(3);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<{ topic: Topic; question: string } | null>(null);
  const [spread, setSpread] = useState<SpreadReading | null>(null);

  function pull() {
    setAsked({ topic, question: question.trim() });
    setSpread(readSpread(draw(size), topic));
  }

  // Client-only: the seed and the local date both come from the device.
  useEffect(() => { setDaily(dailyCard(personKey(), today())); }, []);

  return (
    <main className="wrap">
      <div className="head">
        <div>
          <h1>{S.title[L]}</h1>
          <p className="sub">{S.tagline[L]}</p>
        </div>
        <LangSwitch locale={L} onChange={setLocale} />
      </div>
      <Nav locale={L} />

      <section>
        <h2>{S.daily[L]}</h2>
        {daily && <CardFace d={daily} L={L} />}
      </section>

      <section>
        <h2>{S.spread[L]}</h2>
        <div className="card">
          <div className="tarot-ask-label">{S.topicLabel[L]}</div>
          <div className="tabs wrap-tabs" role="group" aria-label={S.topicLabel[L]}>
            {TOPICS.map((k) => (
              <button key={k} type="button" aria-pressed={topic === k} onClick={() => setTopic(k)}>{TOPIC_NAME[k][L]}</button>
            ))}
          </div>
          <div className="tarot-ask-label">{S.sizeLabel[L]}</div>
          <div className="tabs" role="group" aria-label={S.sizeLabel[L]}>
            {SIZES.map((n) => (
              <button key={n} type="button" aria-pressed={size === n} onClick={() => setSize(n)}>{n}{S.cardWord[L]}</button>
            ))}
          </div>
          <div className="field-wide">
            <label htmlFor="tq">{S.question[L]}</label>
            <input id="tq" type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder={S.questionPh[L]} enterKeyHint="go"
              onKeyDown={(e) => { if (e.key === 'Enter') pull(); }} />
          </div>
          <p className="note" style={{ marginTop: 8 }}>{S.hint[L]}</p>
          <button type="button" style={{ width: '100%', marginTop: 12 }} onClick={pull}>
            {spread ? S.redraw[L] : S.drawBtn[L]}
          </button>
        </div>

        {spread && asked && (
          <>
            <p className="tarot-asked">
              {S.youAsked[L]}：{asked.question || TOPIC_NAME[asked.topic][L]}
              {asked.question && <span className="tarot-topic"> · {TOPIC_NAME[asked.topic][L]}</span>}
            </p>
            <div className={`tarot-spread n${spread.cards.length}`}>
              {spread.cards.map((c, i) => (
                <CardFace key={i} d={c.draw} L={L} position={c.position[L]} meaning={c.meaning[L]} />
              ))}
            </div>
            <div className="card" style={{ marginTop: 10 }}>
              <div className="tarot-ask-label">{S.overall[L]}</div>
              {spread.summary.map((line, i) => <p key={i} className="tarot-meaning" style={{ marginTop: i ? 6 : 0 }}>{line[L]}</p>)}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
