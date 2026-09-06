'use client';

/**
 * The short-range relationship outlook.
 *
 * Presented flatly on purpose. Quiet days are shown as quiet rather than
 * padded with something to say, and the caveat about 流日 being the lightest
 * layer sits under the result rather than buried in a footnote — a forecast
 * that finds meaning in every day is measuring nothing.
 */

import { useState } from 'react';
import { UI } from '../src/i18n/ui';
import type { Locale } from '../src/i18n/text';

interface DayView {
  date: string;
  ganZhi: string;
  band: 'notable' | 'mild' | 'quiet';
  tone: 'easy' | 'friction' | null;
  score: number;
  notes: string[];
}

interface ForecastData {
  from: string;
  to: string;
  headline: string;
  caveat: string;
  quietCount: number;
  monthContext: string[];
  days: DayView[];
}

const SPANS = [7, 14, 30] as const;

/** Weekday initial, from the ISO date, without pulling in a date library. */
function weekday(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const zh = ['日', '一', '二', '三', '四', '五', '六'];
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (locale === 'zh' ? zh : en)[d.getUTCDay()] ?? '';
}

const dayLabel = (isoDate: string) => isoDate.slice(5).replace('-', '/');

export function Forecast({ birth, locale }: {
  birth: Record<string, unknown> | null;
  locale: Locale;
}) {
  const [span, setSpan] = useState<number>(7);
  const [data, setData] = useState<ForecastData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  async function load(days: number) {
    if (!birth) return;
    setSpan(days);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...birth, days, locale }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? UI.errCast[locale]); setData(null); }
      else { setData(json as ForecastData); setOpenDay(null); }
    } catch {
      setError(UI.errConnect[locale]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>{UI.forecast[locale]}</h2>

      <div className="span-row">
        {SPANS.map((s) => (
          <button
            key={s}
            className="span-btn"
            aria-pressed={data !== null && span === s}
            disabled={busy || !birth}
            onClick={() => void load(s)}
          >
            {locale === 'zh' ? `${s} 天` : `${s} days`}
          </button>
        ))}
      </div>

      {error && <p className="err">{error}</p>}
      {busy && <p className="note">{UI.casting[locale]}</p>}

      {data && !busy && (
        <>
          <div className="card">
            <p className="headline">{data.headline}</p>
            {data.monthContext.map((m, i) => (
              <p className="month-ctx" key={i}>{m}</p>
            ))}
          </div>

          <div className="days">
            {data.days.map((d) => {
              const open = openDay === d.date;
              const interactive = d.notes.length > 0;
              return (
                <button
                  key={d.date}
                  className={`day day-${d.band}${d.tone ? ` tone-${d.tone}` : ''}${open ? ' open' : ''}`}
                  onClick={() => setOpenDay(open ? null : d.date)}
                  disabled={!interactive}
                  aria-expanded={interactive ? open : undefined}
                >
                  <span className="day-date">{dayLabel(d.date)}</span>
                  <span className="day-wd">{weekday(d.date, locale)}</span>
                  <span className="day-gz">{d.ganZhi}</span>
                  <span className="day-dot" />
                </button>
              );
            })}
          </div>

          {openDay && (() => {
            const d = data.days.find((x) => x.date === openDay);
            if (!d || d.notes.length === 0) return null;
            return (
              <div className="card day-detail">
                <div className="day-detail-head">
                  {d.date} · {d.ganZhi} · {weekday(d.date, locale)}
                </div>
                <ul className="reasoning">
                  {d.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            );
          })()}

          <p className="caveat">{data.caveat}</p>
        </>
      )}
    </section>
  );
}
