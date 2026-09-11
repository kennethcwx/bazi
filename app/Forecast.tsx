'use client';

/**
 * The short-range outlook.
 *
 * Each day that registers says what it does — close, stirred, friction, apart
 * — rather than good or bad, and each person carries a form for the day:
 * steady or running low on its elements. A quiet day still shows the form,
 * because "you're low today" is worth knowing on exactly the days nothing
 * else is happening.
 *
 * With a partner saved, each day is read three ways and shown three ways:
 * how it sits for you, how it sits for them, and how it sits between you. They
 * are never averaged. A day can be close for one of you and friction for the
 * other, and that is the most useful thing the reading has to say.
 *
 * Tapping a day opens its notes and its twelve 时辰. The hours are a
 * scheduling aid — which carry least structural friction if a conversation has
 * to happen — not an auspicious-hour table, and the caveat under it says so.
 */

import { useState, useEffect } from 'react';
import { UI } from '../src/i18n/ui';
import type { Locale } from '../src/i18n/text';
import { loadPartner } from '../src/storage';
import { PLACES } from '../src/places';

type Band = 'notable' | 'mild' | 'quiet';
type Mode = 'close' | 'stirred' | 'friction' | 'apart' | 'quiet';
type Form = 'steady' | 'low' | null;

interface Side { band: Band; mode: Mode; form: Form; notes: string[] }
interface SoloDay {
  date: string; ganZhi: string; band: Band; mode: Mode; form: Form; notes: string[];
}
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

/** One window. Seven and fourteen days were offered once and never told
 *  the reader anything the month did not. */
const SPAN = 30;
const isJoint = (d: SoloDay | JointDay): d is JointDay => 'yours' in d;

function weekday(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const zh = ['日', '一', '二', '三', '四', '五', '六'];
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (locale === 'zh' ? zh : en)[d.getUTCDay()] ?? '';
}
const dayLabel = (isoDate: string) => isoDate.slice(5).replace('-', '/');

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MODE_UI: Record<Exclude<Mode, 'quiet'>, keyof typeof UI> = {
  close: 'modeClose', stirred: 'modeStirred', friction: 'modeFriction', apart: 'modeApart',
};
const modeWord = (m: Mode, locale: Locale) => (m === 'quiet' ? '' : UI[MODE_UI[m]][locale]);
const formWord = (f: Form, locale: Locale, long = false) =>
  f === 'steady' ? UI[long ? 'formSteadyLong' : 'formSteady'][locale]
    : f === 'low' ? UI[long ? 'formLowLong' : 'formLow'][locale]
      : '';

/** One coloured dot per track — you, them, between — so all three read at a glance. */
function Dots({ day }: { day: JointDay }) {
  return (
    <span className="dot-row">
      {[day.yours, day.theirs, day.between].map((tk, i) => (
        <span key={i} className={`d-dot m-${tk.mode}`} />
      ))}
    </span>
  );
}

/** The one word a day gets in its cell: its mode, or on a quiet day its form. */
function DayWord({ day, locale }: { day: SoloDay | JointDay; locale: Locale }) {
  if (isJoint(day)) return <Dots day={day} />;
  if (day.mode !== 'quiet') {
    return <span className={`day-word m-${day.mode}`}>{modeWord(day.mode, locale)}</span>;
  }
  return <span className={`day-word f-${day.form ?? 'none'}`}>{formWord(day.form, locale)}</span>;
}

/** Mode and form, as small chips at the head of a reading. */
function Chips({ mode, form, locale }: { mode: Mode; form: Form; locale: Locale }) {
  return (
    <span className="chips">
      {mode !== 'quiet' && <span className={`chip m-${mode}`}>{modeWord(mode, locale)}</span>}
      {form && <span className={`chip f-${form}`}>{formWord(form, locale, true)}</span>}
    </span>
  );
}

export function Forecast({ birth, locale }: {
  birth: Record<string, unknown> | null;
  locale: Locale;
}) {
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

  async function load(hoursFor?: string) {
    if (!birth) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...birth, days: SPAN, locale,
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
    void load(date);
  }

  const detail = data?.days.find((d) => d.date === openDay);
  const today = todayIso();
  const modes = ['close', 'stirred', 'friction', 'apart'] as const;

  return (
    <section>
      <h2>{UI.forecast[locale]}</h2>

      <div className="span-row">
        <button className="span-btn"
          aria-pressed={data !== null}
          disabled={busy || !birth}
          onClick={() => { setOpenDay(null); void load(); }}>
          {locale === 'zh' ? `${SPAN} 天` : `${SPAN} days`}
        </button>
      </div>

      {error && <p className="err">{error}</p>}
      {busy && !data && <p className="note">{UI.casting[locale]}</p>}

      {data && (
        <>
          <div className="card">
            <p className="headline">{data.headline}</p>
            {data.monthContext?.map((m, i) => <p className="month-ctx" key={i}>{m}</p>)}
            <div className="legend">
              {modes.map((m) => (
                <span key={m}><i className={`d-dot m-${m}`} />{modeWord(m, locale)}</span>
              ))}
              <span><i className="d-dot f-steady" />{formWord('steady', locale)}</span>
              <span><i className="d-dot f-low" />{formWord('low', locale)}</span>
            </div>
            {data.mode === 'joint' && <p className="note legend-note">{UI.dotOrder[locale]}</p>}
            {data.mode === 'solo' && hasPartner && (
              <p className="note">{UI.jointHint[locale]}</p>
            )}
          </div>

          <div className="days">
            {data.days.map((d) => (
              <button key={d.date}
                className={`day${openDay === d.date ? ' open' : ''}${d.date === today ? ' today' : ''}`}
                aria-expanded={openDay === d.date}
                aria-current={d.date === today ? 'date' : undefined}
                onClick={() => openDetail(d.date)}>
                <span className="day-date">{d.date === today ? UI.today[locale] : dayLabel(d.date)}</span>
                <span className="day-wd">{weekday(d.date, locale)}</span>
                <span className="day-gz">{d.ganZhi}</span>
                <DayWord day={d} locale={locale} />
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
                        <span className={`d-dot m-${side.mode}`} />
                        {label}
                        <Chips mode={side.mode} form={side.form} locale={locale} />
                      </div>
                      {side.notes.length > 0
                        ? <ul className="reasoning">{side.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                        : <p className="note">{UI.nothingInPlay[locale]}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <Chips mode={detail.mode} form={detail.form} locale={locale} />
                  {detail.notes.length > 0
                    ? <ul className="reasoning">{detail.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                    : <p className="note">{UI.nothingInPlay[locale]}</p>}
                </>
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
