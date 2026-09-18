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
import { loadSelf } from '../../src/storage';
import { t } from '../../src/i18n/text';

const S = {
  title: t('塔罗', 'Tarot'),
  tagline: t('每日一牌，与过去／现在／未来三牌阵。', 'A card for the day, and a past / present / future spread.'),
  daily: t('今日牌', 'Card of the day'),
  spread: t('三牌阵', 'Three-card spread'),
  drawBtn: t('抽三张', 'Draw three'),
  redraw: t('重抽', 'Draw again'),
  reversed: t('逆位', 'Reversed'),
  upright: t('正位', 'Upright'),
  positions: [t('过去', 'Past'), t('现在', 'Present'), t('未来', 'Future')],
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

function CardFace({ d, L, position }: { d: Draw; L: 'zh' | 'en'; position?: string }) {
  const meaning = d.reversed ? d.card.reversed : d.card.upright;
  return (
    <div className={`tarot-card${d.reversed ? ' is-reversed' : ''}`}>
      {position && <div className="tarot-pos">{position}</div>}
      <div className="tarot-name">{d.card.name[L]}</div>
      <div className="tarot-orient">{d.reversed ? S.reversed[L] : S.upright[L]}{d.card.suit && ` · ${d.card.suit[L]}`}</div>
      <p className="tarot-meaning">{meaning[L]}</p>
    </div>
  );
}

export default function Tarot() {
  const [L, setLocale] = useLocale();
  const [daily, setDaily] = useState<Draw | null>(null);
  const [spread, setSpread] = useState<Draw[] | null>(null);

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
        {spread
          ? <div className="tarot-spread">{spread.map((d, i) => <CardFace key={i} d={d} L={L} position={S.positions[i]![L]} />)}</div>
          : <p className="note" style={{ marginTop: 0 }}>{S.hint[L]}</p>}
        <button type="button" style={{ width: '100%', marginTop: 12 }} onClick={() => setSpread(draw(3))}>
          {spread ? S.redraw[L] : S.drawBtn[L]}
        </button>
      </section>
    </main>
  );
}
