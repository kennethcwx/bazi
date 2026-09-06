'use client';

/**
 * The short-range outlook.
 *
 * With a partner saved, each day is read three ways and shown three ways:
 * how it sits for you, how it sits for them, and how it sits between you. They
 * are never averaged. A day can be easy for one of you and abrasive for the
 * other, and that is the most useful thing the reading has to say.
 *
 * Tapping a day opens its twelve 时辰. That is a scheduling aid — which hours
 * carry least structural friction if a conversation has to happen — not an
 * auspicious-hour table, and the caveat under it says so.
 */

import { useState, useEffect } from 'react';
import { UI } from '../src/i18n/ui';
import type { Locale } from '../src/i18n/text';
import { loadPartner } from '../src/storage';
import { PLACES } from '../src/places';

type Band = 'notable' | 'mild' | 'quiet';
type Tone = 'easy' | 'friction' | null;

interface Side { band: Band; tone: Tone; notes: string[] }
interface SoloDay { date: string; ganZhi: string; band: Band; tone: Tone; notes: string[] }
interface JointDay { date: string; ganZhi: string; yours: Side; theirs: Side; between: Side }
interface Hour {
  index: number; branch: string; ganZhi: string; range: string;
  band: 'good' | 'neutral' | 'avoid';
  forYou: 'harmony' | 'clash' | null;
  forThem: 'harmony' | 'clash' | null;
  notes: string[];
}

interface Data {
  mode: 'solo' | 'joint';
  from: string; to: string;
  headline: string; caveat: string;
  monthContext?: string[];
  days: (SoloDay | JointDay)[];
  hours: Hour[] | null;
}

const SPANS = [7, 14, 30] as const;
const isJoint = (d: SoloDay | JointDay): d is JointDay => 'yours' in d;

function weekday(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const zh = ['日', '一', '二', '三', '四', '五', '六'];
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (locale === 'zh' ? zh : en)[d.getUTCDay()] ?? '';
}
const dayLabel = (isoDate: string) => isoDate.slice(5).replace('-', '/');

/** One coloured dot per track, so all three read at a glance. */
function Dots({ day }: { day: SoloDay | JointDay }) {
  const tracks: { band: Band; tone: Tone }[] = isJoint(day)
    ? [day.yours, day.theirs, day.between]
    : [{ band: day.band, tone: day.tone }];
  return (
    <span className="dot-row">
      {tracks.map((tk, i) => (
        <span key={i} className={`d-dot b-${tk.band}${tk.tone ? ` t-${tk.tone}` : ''}`} />
      ))}
    </span>
  );
}

export function Forecast({ birth, locale }: {
  birth: Record<string, unknown> | null;
  locale: Locale;
}) {
  const [span, setSpan] = useState<number>(7);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [hasPartner, setHasPartner] = useState(false);

  useEffect(() => { setHasPartner(loadPartner() !== null); }, []);

  /** The partner payload, rebuilt from what was remembered on this device. */
  function partnerBirth(): Record<string, unknown> | null {
    const p = loadPartner();
    if (!p) return null;
    const place = PLACES[p.placeIndex] ?? PLACES[0]!;
    const [y, mo, d] = p.date.split('-').map(Number);
    const [h, mi] = p.time ? p.time.split(':').map(Number) : [undefined, undefined];
    return {
      year: y, month: mo, day: d,
      ...(p.timeKnown && h !== undefined ? { hour: h, minute: mi ?? 0 } : {}),
      timeZone: place.tz, longitude: place.lon, gender: p.gender,
      useTrueSolarTime: p.useTrueSolarTime,
    };
  }

  async function load(days: number, hoursFor?: string) {
    if (!birth) return;
    setSpan(days);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...birth, days, locale,
          ...(partnerBirth() ? { partner: partnerBirth() } : {}),
          ...(hoursFor ? { hoursFor } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? UI.errCast[locale]); setData(null); }
      else setData(json as Data);
    } catch {
      setError(UI.errConnect[locale]);
    } finally {
      setBusy(false);
    }
  }

  function openDetail(date: string) {
    if (openDay === date) { setOpenDay(null); return; }
    setOpenDay(date);
    void load(span, date);
  }

  const detail = data?.days.find((d) => d.date === openDay);

  return (
    <section>
      <h2>{UI.forecast[locale]}</h2>

      <div className="span-row">
        {SPANS.map((s) => (
          <button key={s} className="span-btn"
            aria-pressed={data !== null && span === s}
            disabled={busy || !birth}
            onClick={() => { setOpenDay(null); void load(s); }}>
            {locale === 'zh' ? `${s} 天` : `${s} days`}
          </button>
        ))}
      </div>

      {error && <p className="err">{error}</p>}
      {busy && !data && <p className="note">{UI.casting[locale]}</p>}

      {data && (
        <>
          <div className="card">
            <p className="headline">{data.headline}</p>
            {data.monthContext?.map((m, i) => <p className="month-ctx" key={i}>{m}</p>)}
            {data.mode === 'joint' && (
              <div className="legend">
                <span><i className="d-dot b-notable" />{UI.trackYours[locale]}</span>
                <span><i className="d-dot b-notable" />{UI.trackTheirs[locale]}</span>
                <span><i className="d-dot b-notable" />{UI.trackBetween[locale]}</span>
              </div>
            )}
            {data.mode === 'solo' && hasPartner && (
              <p className="note">{UI.jointHint[locale]}</p>
            )}
          </div>

          <div className="days">
            {data.days.map((d) => (
              <button key={d.date}
                className={`day${openDay === d.date ? ' open' : ''}`}
                aria-expanded={openDay === d.date}
                onClick={() => openDetail(d.date)}>
                <span className="day-date">{dayLabel(d.date)}</span>
                <span className="day-wd">{weekday(d.date, locale)}</span>
                <span className="day-gz">{d.ganZhi}</span>
                <Dots day={d} />
              </button>
            ))}
          </div>

          {detail && (
            <div className="card day-detail">
              <div className="day-detail-head">
                {detail.date} · {detail.ganZhi} · {weekday(detail.date, locale)}
              </div>

              {isJoint(detail) ? (
                <div className="tracks">
                  {([
                    [UI.trackYours[locale], detail.yours],
                    [UI.trackTheirs[locale], detail.theirs],
                    [UI.trackBetween[locale], detail.between],
                  ] as const).map(([label, side]) => (
                    <div className="track" key={label}>
                      <div className="track-head">
                        <span className={`d-dot b-${side.band}${side.tone ? ` t-${side.tone}` : ''}`} />
                        {label}
                      </div>
                      {side.notes.length > 0
                        ? <ul className="reasoning">{side.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                        : <p className="note">{UI.nothingInPlay[locale]}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                detail.notes.length > 0
                  ? <ul className="reasoning">{detail.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                  : <p className="note">{UI.nothingInPlay[locale]}</p>
              )}

              {data.hours && (
                <div className="hours">
                  <div className="hours-head">{UI.hoursTitle[locale]}</div>
                  <div className="hour-grid">
                    {data.hours.map((h) => (
                      <div key={h.index} className={`hour h-${h.band}`}
                        title={h.notes.join('; ')}>
                        <span className="hour-branch">{h.branch}</span>
                        <span className="hour-range">{h.range}</span>
                        <span className="hour-sides">
                          <i className={`hs hs-${h.forYou ?? 'none'}`} />
                          {hasPartner && <i className={`hs hs-${h.forThem ?? 'none'}`} />}
                        </span>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const good = data.hours.filter((h) => h.band === 'good');
                    const avoid = data.hours.filter((h) => h.band === 'avoid');
                    return (
                      <ul className="reasoning">
                        <li>
                          {UI.hoursGood[locale]}：{good.length > 0
                            ? good.map((h) => {
                                const who = h.forYou === 'harmony' && h.forThem === 'harmony'
                                  ? UI.trackBetween[locale]
                                  : h.forYou === 'harmony' ? UI.trackYours[locale] : UI.trackTheirs[locale];
                                return `${h.branch} ${h.range}（${who}）`;
                              }).join('、')
                            : UI.hoursNone[locale]}
                        </li>
                        {avoid.length > 0 && (
                          <li>
                            {UI.hoursAvoid[locale]}：{avoid.map((h) => `${h.branch} ${h.range}`).join('、')}
                          </li>
                        )}
                      </ul>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          <p className="caveat">{data.caveat}</p>
        </>
      )}
    </section>
  );
}
