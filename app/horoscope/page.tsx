'use client';

/**
 * 星盘 — the Western natal chart for the same birth the 八字 page remembers.
 *
 * The form is the 八字 one minus gender and true-solar time, which the
 * chart does not use. A remembered birth casts on load, so the second
 * visit is one tap fewer.
 */

import { useEffect, useState, type FormEvent } from 'react';
import Nav from '../Nav';
import Wheel from './Wheel';
import { PlacePicker } from '../PlacePicker';
import { LangSwitch, useLocale } from '../useLocale';
import { DEFAULT_PLACE } from '../../src/places';
import { loadSelf, saveSelf } from '../../src/storage';
import { UI } from '../../src/i18n/ui';
import { t } from '../../src/i18n/text';

const S = {
  title: t('星盘', 'Natal Chart'),
  tagline: t('回归黄道、整宫制。行星、宫位与相位都可核对。',
    'Tropical zodiac, whole-sign houses. Every placement and aspect is shown, not summarised away.'),
  cast: t('排星盘', 'Cast the chart'),
  casting: t('计算中…', 'Casting…'),
  placements: t('行星落座', 'Placements'),
  angles: t('上升与天顶', 'Angles'),
  asc: t('上升', 'Ascendant'),
  mc: t('天顶', 'Midheaven'),
  house: t('宫', 'H'),
  retro: t('逆', 'R'),
  reading: t('解读', 'Reading'),
  aspects: t('主要相位', 'Major aspects'),
  noTime: t('未填出生时间：以正午计算。上升与宫位无法判定，月亮可能偏差半个星座。',
    'No birth time: cast for noon. The Ascendant and houses cannot be found, and the Moon may be off by half a sign.'),
  noAspects: t('没有主要相位在容许度内。', 'No major aspects within orb.'),
};

interface Placed { key: string; name: string; glyph: string; lon: number; sign: string; signGlyph: string; degree: number; retrograde: boolean; house: number | null }
interface Result {
  timeKnown: boolean;
  planets: Placed[];
  ascendant: { lon: number; sign: string; signGlyph: string; degree: number } | null;
  midheaven: { lon: number; sign: string; signGlyph: string; degree: number } | null;
  aspects: { a: string; b: string; kind: string; orb: number }[];
  reading: { sun: string; moon: string; ascendant: string | null; placements: string[]; aspects: string[] };
}

export default function Horoscope() {
  const [L, setLocale] = useLocale();
  const [date, setDate] = useState('1990-06-15');
  const [time, setTime] = useState('14:30');
  const [timeKnown, setTimeKnown] = useState(true);
  const [place, setPlace] = useState(DEFAULT_PLACE);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function cast(p: { date: string; time: string; timeKnown: boolean; placeIndex: number }, locale = L) {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/natal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, locale }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? UI.errCast[locale]); setResult(null); }
      else setResult(json as Result);
    } catch { setError(UI.errConnect[locale]); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const mine = loadSelf();
    if (!mine) return;
    setDate(mine.date); setTime(mine.time || '12:00'); setTimeKnown(mine.timeKnown); setPlace(mine.placeIndex);
    void cast({ date: mine.date, time: mine.time, timeKnown: mine.timeKnown, placeIndex: mine.placeIndex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const mine = loadSelf();
    saveSelf({
      date, time: timeKnown ? time : '', gender: mine?.gender ?? 'male', placeIndex: place, timeKnown,
      useTrueSolarTime: mine?.useTrueSolarTime ?? true,
    });
    void cast({ date, time, timeKnown, placeIndex: place });
  }

  function changeLocale(next: typeof L) {
    setLocale(next);
    if (result) void cast({ date, time, timeKnown, placeIndex: place }, next);
  }

  const angle = (a: NonNullable<Result['ascendant']>) => `${a.signGlyph} ${a.sign} ${a.degree.toFixed(1)}°`;

  return (
    <main className="wrap">
      <div className="head">
        <div>
          <h1>{S.title[L]}</h1>
          <p className="sub">{S.tagline[L]}</p>
        </div>
        <LangSwitch locale={L} onChange={changeLocale} />
      </div>
      <Nav locale={L} />

      <form onSubmit={submit}>
        <div>
          <label htmlFor="date">{UI.birthDate[L]}</label>
          <input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="time">{UI.birthTime[L]}</label>
          <input id="time" type="time" disabled={!timeKnown} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <PlacePicker id="place" value={place} onChange={setPlace} locale={L} />
        <div className="checks">
          <span className="checkline">
            <input id="tk" type="checkbox" checked={timeKnown} onChange={(e) => setTimeKnown(e.target.checked)} />
            <label htmlFor="tk">{UI.knowTime[L]}</label>
          </span>
        </div>
        <div className="field-wide">
          <button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? S.casting[L] : S.cast[L]}</button>
        </div>
      </form>

      {error && <p className="err" role="alert">{error}</p>}

      {result && (
        <>
          {!result.timeKnown && <p className="note">{S.noTime[L]}</p>}

          <section>
            <h2>{S.placements[L]}</h2>
            <div className="card">
              <Wheel
                planets={result.planets}
                ascendant={result.ascendant?.lon ?? null}
                midheaven={result.midheaven?.lon ?? null}
                aspects={result.aspects}
              />
              <table className="planets">
                <tbody>
                  {result.planets.map((p) => (
                    <tr key={p.key}>
                      <td className="pl-glyph" aria-hidden="true">{p.glyph}</td>
                      <td>{p.name}{p.retrograde && <span className="pl-retro"> {S.retro[L]}</span>}</td>
                      <td><span aria-hidden="true">{p.signGlyph} </span>{p.sign} {p.degree.toFixed(1)}°</td>
                      <td className="pl-house">{p.house !== null && `${S.house[L]}${p.house}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.ascendant && result.midheaven && (
                <div className="glance" style={{ marginTop: 12 }}>
                  <div className="glance-row"><span className="glance-k">{S.asc[L]}</span><span className="glance-v">{angle(result.ascendant)}</span></div>
                  <div className="glance-row"><span className="glance-k">{S.mc[L]}</span><span className="glance-v">{angle(result.midheaven)}</span></div>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2>{S.reading[L]}</h2>
            <div className="card">
              <p className="verdict">{result.reading.sun}</p>
              <p>{result.reading.moon}</p>
              {result.reading.ascendant && <p>{result.reading.ascendant}</p>}
              <ul className="reasoning">
                {result.reading.placements.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </section>

          <section>
            <h2>{S.aspects[L]}</h2>
            <div className="card">
              {result.reading.aspects.length === 0
                ? <p className="note" style={{ marginTop: 0 }}>{S.noAspects[L]}</p>
                : <ul className="reasoning" style={{ marginTop: 0 }}>{result.reading.aspects.map((r, i) => <li key={i}>{r}</li>)}</ul>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
