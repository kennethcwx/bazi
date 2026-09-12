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

type Layer = '流年' | '流月';
interface LayerRead { layer: Layer; ganZhi: string; mode: Mode; notes: string[] }
interface LayerPair { year: LayerRead; month: LayerRead }
interface Side { band: Band; mode: Mode; form: Form; notes: string[]; stacked: Layer[] }
interface SoloDay {
  date: string; ganZhi: string; band: Band; mode: Mode; form: Form; notes: string[];
  stacked: Layer[];
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
  /** Solo: one pair. Joint: a pair per person. */
  layers?: LayerPair | { yours: LayerPair; theirs: LayerPair };
  days: (SoloDay | JointDay)[];
  hours: Hour[] | null;
}

const isPair = (l: NonNullable<Data['layers']>): l is LayerPair => 'year' in l;

/** Whether any track of this day stacks on a layer. */
const isStacked = (d: SoloDay | JointDay): boolean =>
  isJoint(d) ? d.yours.stacked.length > 0 || d.theirs.stacked.length > 0 : d.stacked.length > 0;

/** 流年 · 流月 for one person, each with what it does to the palace. */
function LayerLine({ pair, who, locale }: { pair: LayerPair; who?: string; locale: Locale }) {
  const one = (l: LayerRead) => (
    <span className="layer">
      <span className="layer-k">{l.layer === '流年' ? UI.layerYear[locale] : UI.layerMonth[locale]}</span>
      {' '}<span className="layer-gz">{l.ganZhi}</span>
      {' '}<span className={`layer-mode m-${l.mode}`}>{l.mode === 'quiet' ? UI.modeQuiet[locale] : modeWord(l.mode, locale)}</span>
    </span>
  );
  return (
    <p className="layers">
      {who && <span className="layer-who">{who}</span>}
      {one(pair.year)}{one(pair.month)}
    </p>
  );
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
/* Three marks, one per track. The shape carries the mode (see .d-dot in the
   stylesheet) and the hidden text carries it for a screen reader, which
   otherwise hears a date and a 干支 and nothing about the day. */
function Dots({ day, locale }: { day: JointDay; locale: Locale }) {
  const tracks = [
    [UI.trackYours[locale], day.yours],
    [UI.trackTheirs[locale], day.theirs],
    [UI.trackBetween[locale], day.between],
  ] as const;
  const said = tracks
    .map(([label, side]) => `${label}: ${side.mode === 'quiet' ? UI.modeQuiet[locale] : modeWord(side.mode, locale)}`)
    .join(', ');
  return (
    <span className="dot-row">
      {tracks.map(([label, side]) => (
        <span key={label} className={`d-dot m-${side.mode}`} />
      ))}
      <span className="sr-only">{said}</span>
    </span>
  );
}

/** The one word a day gets in its cell: its mode, or on a quiet day its form. */
function DayWord({ day, locale }: { day: SoloDay | JointDay; locale: Locale }) {
  if (isJoint(day)) return <Dots day={day} locale={locale} />;
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

  // Loads itself when the birth or the language changes. The button it
  // replaces asked for one tap to see the only thing the tab shows; after the
  // 7/14-day spans went there was nothing left for a button to choose.
  // Keyed on the serialised birth: the parent hands down the same object
  // across renders, so identity alone would not refire on a recast.
  const birthKey = birth ? JSON.stringify(birth) : null;
  useEffect(() => {
    if (!birthKey) return;
    setOpenDay(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthKey, locale]);

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

      {error && <p className="err" role="alert">{error}</p>}
      {busy && !data && <p className="note" role="status">{UI.casting[locale]}</p>}

      {data && (
        <>
          <div className="card">
            <p className="headline">{data.headline}</p>
            {/* The layers the window sits in. A day is read inside its month
                and year; these say what those two are doing to the palace
                across the whole span, so a stacked day has something to
                stack on. */}
            {data.layers && (isPair(data.layers)
              ? <LayerLine pair={data.layers} locale={locale} />
              : <>
                  <LayerLine pair={data.layers.yours} who={UI.trackYours[locale]} locale={locale} />
                  <LayerLine pair={data.layers.theirs} who={UI.trackTheirs[locale]} locale={locale} />
                </>)}
            {data.layers && [
              ...(isPair(data.layers) ? [data.layers.year, data.layers.month]
                : [data.layers.yours.year, data.layers.yours.month, data.layers.theirs.year, data.layers.theirs.month]),
            ].flatMap((l) => l.notes).map((n, i) => <p className="month-ctx" key={i}>{n}</p>)}
            <div className="legend">
              {modes.map((m) => (
                <span key={m}><i className={`d-dot m-${m}`} />{modeWord(m, locale)}</span>
              ))}
              <span><i className="d-dot f-steady" />{formWord('steady', locale)}</span>
              <span><i className="d-dot f-low" />{formWord('low', locale)}</span>
            </div>
            {data.mode === 'joint' && <p className="note legend-note">{UI.dotOrder[locale]}</p>}
            {data.days.some(isStacked) && <p className="note legend-note">{UI.stackedHint[locale]}</p>}
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
                <span className="day-gz">{isStacked(d) && <span className="stack-mark" aria-label={UI.stackedHint[locale]}>{UI.stackedMark[locale]}</span>}{d.ganZhi}</span>
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
                        <span className={`d-dot m-${side.mode}`} aria-hidden="true" />
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
                          {(h.forYou || h.forThem) && (
                            <span className="sr-only">
                              {[
                                h.forYou && `${UI.trackYours[locale]}: ${UI[h.forYou === 'harmony' ? 'hourHarmony' : 'hourClash'][locale]}`,
                                h.forThem && `${UI.trackTheirs[locale]}: ${UI[h.forThem === 'harmony' ? 'hourHarmony' : 'hourClash'][locale]}`,
                              ].filter(Boolean).join(', ')}
                            </span>
                          )}
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
