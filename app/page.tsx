'use client';

/**
 * The one screen.
 *
 * Order is the argument: the chart comes first because it is the thing a
 * practitioner checks, then how it was derived (旺衰, 用神, with the school
 * named), then the luck timeline, then the reading, and the raw findings last.
 * The conclusions sit downstream of everything above and the layout says so.
 *
 * The 依据 citations under each section of a reading are shown, not hidden.
 * They are the product's whole claim — that a reading can be argued with.
 *
 * Language: the API returns one locale, so switching re-fetches rather than
 * shipping both languages to a phone to display half of them. 干支 characters
 * never translate — they are the chart itself.
 */

import {
  useState, useRef, useEffect, useCallback,
  type ReactNode, type FormEvent, type CSSProperties,
} from 'react';
import type { Chart, Element, Pillar } from '../src/engine/types';
import type { RenderedFinding } from '../src/analyzer/findings';
import { formatNote, formatLuckStart, isCaveat } from '../src/i18n/notes';
import { UI } from '../src/i18n/ui';
import {
  ELEMENT, TEN_GOD, TEN_GOD_GLOSS, TERRAIN, DECADE_VERDICT, SHENSHA, term,
} from '../src/i18n/glossary';
import { htmlLang, isLocale, type Locale } from '../src/i18n/text';
import { findingLabel } from '../src/i18n/finding-labels';
import { TEMPLATES } from '../src/narrator/templates';
import { Forecast } from './Forecast';
import { Compatibility } from './Compatibility';
import { PlacePicker } from './PlacePicker';
import { PLACES, DEFAULT_PLACE } from '../src/places';
import { loadSelf, saveSelf, forgetAll, hasSaved } from '../src/storage';

interface DecadeView {
  index: number; startAge: number; endAge: number;
  startYear: number; endYear: number; ganZhi: string;
  score: number; verdict: string; notes: string[];
}

interface AnnualView {
  year: number; age: number; ganZhi: string;
  stem: string; branch: string;
  stemTenGod: string; branchTenGod: string; current: boolean;
}

interface MonthView {
  year: number; index: number; ganZhi: string;
  stemTenGod: string; branchTenGod: string;
  starts: string; score: number; verdict: string; notes: string[]; current: boolean;
}

interface StarHit { name: string; position: string; meaning: string }

interface Result {
  locale: Locale;
  chart: Chart;
  annual: AnnualView[];
  monthly: MonthView[];
  shensha: StarHit[];
  strength: {
    elementPercent: Record<Element, number>;
    supportPercent: number;
    verdict: string;
    reasoning: string[];
  };
  yongShen: {
    primary: Element;
    secondary: Element | null;
    unfavourable: Element[];
    neutral: Element[];
    school: string;
    reasoning: string[];
  };
  relationship: { findings: RenderedFinding[]; primaryStar: string };
  career: { findings: RenderedFinding[]; decades: DecadeView[]; structure: string; lean: string };
}

interface Grounding {
  cited: string[]; invalid: string[]; uncitedLeads: string[]; ok: boolean;
}

type Topic = 'relationship' | 'career';

const PILLAR_KEY = {
  year: 'yearPillar', month: 'monthPillar', day: 'dayPillar', hour: 'hourPillar',
} as const;

/** The 神煞 branch label each pillar position carries in a hit. */
const STAR_POSITION: Record<keyof typeof PILLAR_KEY, string> = {
  year: '年支', month: '月支', day: '日支', hour: '时支',
};

function PillarCard({ p, position, locale, stars = [] }: {
  p: Pillar | null; position: keyof typeof PILLAR_KEY; locale: Locale; stars?: StarHit[];
}) {
  const label = UI[PILLAR_KEY[position]][locale];
  if (!p) {
    return (
      <div className="pillar unknown">
        <div className="pos">{label}</div>
        <div className="tengod">—</div>
        <div className="gz">——</div>
        <div className="hidden">{UI.timeUnknown[locale]}</div>
      </div>
    );
  }
  return (
    <div className={`pillar${position === 'day' ? ' is-day' : ''}`}>
      {p.isVoid && <span className="void">{UI.void[locale]}</span>}
      <div className="pos">{label}</div>
      <div className="tengod">
        {p.tenGod ? TEN_GOD[p.tenGod]![locale] : UI.dayMaster[locale]}
      </div>
      {/* 干支 characters are the chart itself and never translate. */}
      <div className="gz">
        <span className={`el-${p.stemElement}`}>{p.stem}</span>
        <span className={`el-${p.branchElement}`}>{p.branch}</span>
      </div>
      <div className="hidden">
        {p.hiddenStems.map((h) => (
          <div key={h.stem + h.role}>
            <span className={`el-${h.element}`}>{h.stem}</span>{' '}
            {TEN_GOD[h.tenGod]![locale]}
          </div>
        ))}
      </div>
      <div className="meta">
        <div>{p.naYin}</div>
        {/* On the day pillar the 长生 phase is the 日主 on its own branch —
            自坐 — and is labelled as such, the way a full 排盘 reads it. */}
        <div>
          {position === 'day' && <span className="meta-k">{UI.selfSeat[locale]} </span>}
          {TERRAIN[p.terrain]?.[locale] ?? p.terrain}
        </div>
        {stars.length > 0 && (
          <div className="stars">
            {stars.map((s, i) => (
              <span key={s.name + i} className="star" title={s.meaning}>
                {SHENSHA[s.name]?.[locale] ?? s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Render the narrator's output.
 *
 * The format is deliberately minimal — `### heading`, paragraphs, and a
 * `依据：` line per section — so this needs no markdown dependency and cannot
 * be used to inject markup. The 依据 marker is the same in both languages so
 * there is one parser and nothing to go wrong if a model mixes them.
 */
function Reading({ text, streaming, locale }: {
  text: string; streaming: boolean; locale: Locale;
}) {
  const blocks: ReactNode[] = [];
  let key = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('###')) {
      blocks.push(<h3 key={key++}>{line.replace(/^#+\s*/, '')}</h3>);
    } else if (/^(依据|Basis|Sources?)[:：]/i.test(line)) {
      // The raw ids are developer output. Name what each one is.
      const ids = line
        .replace(/^(依据|Basis|Sources?)[:：]\s*/i, '')
        .split(/[,，、\s]+/)
        .map((x) => x.trim().replace(/[。.]$/, ''))
        .filter(Boolean);
      blocks.push(
        <p className="cite" key={key++}>
          <span className="cite-lead">{UI.basedOn[locale]}</span>
          {ids.map((id) => (
            <span className="cite-chip" key={id}>{findingLabel(id, locale)}</span>
          ))}
        </p>,
      );
    } else {
      blocks.push(<p key={key++}>{line}</p>);
    }
  }

  return (
    <div className="reading">
      {blocks}
      {streaming && <span className="cursor" aria-label={UI.generating[locale]} />}
    </div>
  );
}

/**
 * A short glossary for whichever 十神 the reading actually used.
 *
 * The reading assumes these terms. In English the claims gloss them inline,
 * but the Chinese ones do not, and a reader meeting 伤官 for the first time has
 * no way in. Collapsed so it costs nothing on a phone, and derived from the
 * text so it never lists a term that was not used.
 */
function TermsUsed({ text, locale }: { text: string; locale: Locale }) {
  const used = (Object.keys(TEN_GOD_GLOSS) as string[]).filter((zh) =>
    text.includes(zh) || text.includes(TEN_GOD[zh]!.en));
  if (used.length === 0) return null;

  return (
    <details className="why terms">
      <summary>{UI.termsUsed[locale]}（{used.length}）</summary>
      <dl className="terms-list">
        {used.map((zh) => (
          <div key={zh}>
            <dt>{locale === 'zh' ? zh : `${TEN_GOD[zh]![locale]} ${zh}`}</dt>
            <dd>{TEN_GOD_GLOSS[zh]![locale]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function FindingList({ findings, locale }: { findings: RenderedFinding[]; locale: Locale }) {
  if (findings.length === 0) return <p className="note">{UI.noFindings[locale]}</p>;
  return (
    <>
      {findings.map((f) => (
        <div className="finding" key={f.id}>
          <div className="claim">
            {f.claim}
            <span className={`tag${f.confidence === 'low' ? ' low' : ''}`}>
              {f.confidence === 'high' ? UI.confHigh[locale]
                : f.confidence === 'medium' ? UI.confMedium[locale]
                : UI.confLow[locale]}
            </span>
          </div>
          <details className="why">
            <summary>{UI.showEvidence[locale]}</summary>
            <ul className="ev">
              {f.evidence.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </details>
        </div>
      ))}
    </>
  );
}

export default function Page() {
  const [locale, setLocale] = useState<Locale>('zh');
  const [place, setPlace] = useState(DEFAULT_PLACE);
  const [timeKnown, setTimeKnown] = useState(true);
  const [trueSolar, setTrueSolar] = useState(true);
  // Controlled, because remembered details arrive after mount and
  // defaultValue would already have been read by then.
  const [date, setDate] = useState('1990-06-15');
  const [time, setTime] = useState('14:30');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [remembered, setRemembered] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Topic>('relationship');

  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [reading, setReading] = useState('');
  const [readingBusy, setReadingBusy] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [readingSource, setReadingSource] = useState<string | null>(null);
  const [grounding, setGrounding] = useState<Grounding | null>(null);

  /** The birth payload that produced the current chart, reused for readings. */
  const lastInput = useRef<Record<string, unknown> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // The root <html lang> is server-rendered as zh-Hans; keep it honest once
  // the interface switches, or VoiceOver reads English with a Mandarin voice.
  useEffect(() => { document.documentElement.lang = htmlLang(locale); }, [locale]);

  // Remember the language choice. Wrapped because storage throws in some
  // privacy modes, and a language toggle is not worth a blank page.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('bazi_locale');
      if (isLocale(saved)) setLocale(saved);
      else if (!navigator.language.toLowerCase().startsWith('zh')) setLocale('en');
    } catch { /* storage unavailable; keep the default */ }

    const mine = loadSelf();
    if (mine) {
      setDate(mine.date);
      setTime(mine.time);
      setGender(mine.gender);
      setPlace(mine.placeIndex);
      setTimeKnown(mine.timeKnown);
      setTrueSolar(mine.useTrueSolarTime);
      setRemembered(true);
    }
  }, []);

  const castChart = useCallback(async (
    payload: Record<string, unknown>,
    forLocale: Locale,
    scroll: boolean,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, locale: forLocale }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? UI.errCast[forLocale]); setResult(null); }
      else {
        setResult(json as Result);
        if (scroll) {
          requestAnimationFrame(() =>
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          );
        }
      }
    } catch {
      setError(UI.errConnect[forLocale]);
    } finally {
      setBusy(false);
    }
  }, []);

  function changeLocale(next: Locale) {
    setLocale(next);
    try { window.localStorage.setItem('bazi_locale', next); } catch { /* ignore */ }
    // A reading is language-specific; drop it rather than show Chinese prose
    // under an English interface.
    clearReading();
    if (lastInput.current) void castChart(lastInput.current, next, false);
  }

  /**
   * Clear whatever reading is on screen.
   *
   * A reading answers one question; it must not survive a tab switch, a
   * language change or a new chart. This also stops a stale error — an API
   * failure from a question clicked earlier — looking like the tab caused it.
   */
  function clearReading() {
    setReading('');
    setActiveTemplate(null);
    setGrounding(null);
    setReadingError(null);
    setReadingSource(null);
  }

  function switchTab(next: Topic) {
    if (next === tab) return;
    setTab(next);
    clearReading();
  }

  function currentBirth() {
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time ? time.split(':').map(Number) : [undefined, undefined];
    const p = PLACES[place]!;
    return {
      year: y, month: mo, day: d,
      ...(timeKnown && h !== undefined ? { hour: h, minute: mi ?? 0 } : {}),
      timeZone: p.tz,
      longitude: p.lon,
      gender,
      useTrueSolarTime: trueSolar,
    };
  }

  function forget() {
    forgetAll();
    setRemembered(false);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearReading();
    const payload = currentBirth();
    lastInput.current = payload;
    // Remembering on cast rather than behind a checkbox: the user has already
    // typed it, and a "remember me" box they must find is friction for no gain.
    saveSelf({ date, time, gender, placeIndex: place, timeKnown, useTrueSolarTime: trueSolar });
    setRemembered(true);
    await castChart(payload, locale, true);
  }

  /** Stream a reading for one template. */
  async function ask(templateId: string) {
    if (!lastInput.current || readingBusy) return;
    setActiveTemplate(templateId);
    setReading('');
    setGrounding(null);
    setReadingError(null);
    setReadingBusy(true);

    try {
      const res = await fetch('/api/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lastInput.current, templateId, locale }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        setReadingError(json.error ?? UI.errReading[locale]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; keep the trailing partial.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const lines = frame.split('\n');
          const evLine = lines.find((l) => l.startsWith('event: '));
          const dataLine = lines.find((l) => l.startsWith('data: '));
          if (!evLine || !dataLine) continue;

          const event = evLine.slice(7).trim();
          let data: Record<string, unknown>;
          try { data = JSON.parse(dataLine.slice(6)); } catch { continue; }

          if (event === 'meta') {
            setReadingSource(String(data['source'] ?? ''));
          } else if (event === 'delta') {
            acc += String(data['text'] ?? '');
            setReading(acc);
          } else if (event === 'done') {
            setGrounding(data['grounding'] as Grounding);
          } else if (event === 'failed') {
            setReadingError(String(data['error'] ?? UI.errReading[locale]));
          }
        }
      }
    } catch {
      setReadingError(UI.errStreamCut[locale]);
    } finally {
      setReadingBusy(false);
    }
  }

  const elements: Element[] = ['木', '火', '土', '金', '水'];
  const topicTemplates = TEMPLATES.filter((t) => t.topic === tab);
  const L = locale;

  return (
    <main className="wrap">
      <div className="head">
        <div>
          <h1>{UI.title[L]}</h1>
          <p className="sub">{UI.tagline[L]}</p>
        </div>
        <div className="lang" role="group" aria-label="Language">
          <button
            type="button"
            aria-pressed={L === 'zh'}
            onClick={() => changeLocale('zh')}
          >中文</button>
          <button
            type="button"
            aria-pressed={L === 'en'}
            onClick={() => changeLocale('en')}
          >EN</button>
        </div>
      </div>

      <form onSubmit={submit}>
        <div>
          <label htmlFor="date">{UI.birthDate[L]}</label>
          <input id="date" name="date" type="date" required
            value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="time">{UI.birthTime[L]}</label>
          <input id="time" name="time" type="time" disabled={!timeKnown}
            value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label htmlFor="gender">{UI.gender[L]}</label>
          <select id="gender" name="gender" value={gender}
            onChange={(e) => setGender(e.target.value as 'male' | 'female')}>
            <option value="male">{UI.male[L]}</option>
            <option value="female">{UI.female[L]}</option>
          </select>
        </div>
        <PlacePicker id="place" value={place} onChange={setPlace} locale={L} />

        <div className="checks">
          <span className="checkline">
            <input id="tk" type="checkbox" checked={timeKnown}
              onChange={(e) => setTimeKnown(e.target.checked)} />
            <label htmlFor="tk">{UI.knowTime[L]}</label>
          </span>
          <span className="checkline">
            <input id="ts" type="checkbox" checked={trueSolar}
              onChange={(e) => setTrueSolar(e.target.checked)} disabled={!timeKnown} />
            <label htmlFor="ts">{UI.useTrueSolar[L]}</label>
          </span>
        </div>

        <div className="field-wide">
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? UI.casting[L] : UI.cast[L]}
          </button>
        </div>
      </form>

      {remembered && hasSaved() && (
        <p className="remembered">
          {UI.remembered[L]}
          <button type="button" className="linkish" onClick={forget}>{UI.forget[L]}</button>
        </p>
      )}

      {error && <p className="err" role="alert">{error}</p>}

      {result && (
        <div ref={resultsRef}>
          <section>
            <h2>{UI.headlineLabel[L]}</h2>
            <div className="card glance">
              <div className="glance-row">
                <span className="glance-k">{UI.dayMaster[L]}</span>
                <span className="glance-v">
                  {result.chart.dayMaster} · {term(result.strength.verdict, L)}
                </span>
              </div>
              <div className="glance-row">
                <span className="glance-k">{UI.favourable[L]}</span>
                <span className={`glance-v el-${result.yongShen.primary}`}>
                  {ELEMENT[result.yongShen.primary]![L]}
                  {result.yongShen.secondary && ` · ${ELEMENT[result.yongShen.secondary]![L]}`}
                </span>
              </div>
              <div className="glance-row">
                <span className="glance-k">{UI.relationships[L]}</span>
                <span className="glance-v">
                  {result.relationship.findings[0]?.claim ?? '—'}
                </span>
              </div>
              <div className="glance-row">
                <span className="glance-k">{UI.career[L]}</span>
                <span className="glance-v">
                  {result.career.findings[0]?.claim ?? '—'}
                </span>
              </div>
            </div>
          </section>

          <section>
            <h2>{UI.pillars[L]}</h2>
            <div className="pillars">
              {(['year', 'month', 'day', 'hour'] as const).map((pos) => (
                <PillarCard
                  key={pos}
                  p={result.chart.pillars[pos]}
                  position={pos}
                  locale={L}
                  stars={result.shensha.filter((s) => s.position === STAR_POSITION[pos])}
                />
              ))}
            </div>
            {/* The three derived pillars a full 排盘 lists beside the four. 命宫
                and 身宫 need the hour and are absent without it. */}
            <p className="palaces">
              <span><span className="meta-k">{UI.fetalOrigin[L]}</span> {result.chart.palaces.fetalOrigin}</span>
              {result.chart.palaces.ownSign && (
                <span><span className="meta-k">{UI.ownSign[L]}</span> {result.chart.palaces.ownSign}</span>
              )}
              {result.chart.palaces.bodySign && (
                <span><span className="meta-k">{UI.bodySign[L]}</span> {result.chart.palaces.bodySign}</span>
              )}
            </p>
          </section>

          <section>
            <h2>{UI.basis[L]}</h2>
            <div className="card">
              <div className="glance-v">
                {UI.chartedAt[L]} {result.chart.moment.charted.year}-
                {String(result.chart.moment.charted.month).padStart(2, '0')}-
                {String(result.chart.moment.charted.day).padStart(2, '0')}{' '}
                {String(result.chart.moment.charted.hour).padStart(2, '0')}:
                {String(result.chart.moment.charted.minute).padStart(2, '0')}
              </div>
              <details className="why">
                <summary>{UI.whyThis[L]}</summary>
                <ul className="audit">
                  {result.chart.moment.notes.map((n, i) => (
                    <li key={i} className={isCaveat(n) ? 'warn' : undefined}>
                      {formatNote(n, L)}
                    </li>
                  ))}
                  <li>{formatLuckStart(result.chart.luckStart, result.chart.luckForward, L)}</li>
                </ul>
              </details>
            </div>
          </section>

          <section>
            <h2>{UI.balance[L]}</h2>
            {/* Rows, not a stacked bar. Five segments sharing a phone's width
                left the small ones a few pixels wide, and the label only fit
                above 12% — so the elements you most want named, the scarce
                ones, were the ones rendered as an unlabelled sliver. A row per
                element names all five against a common baseline, and an
                element at 0% now shows as 0% instead of vanishing, which is
                the 五行缺 case people specifically look for. */}
            <div className="balance">
              {elements.map((e) => {
                const pct = result.strength.elementPercent[e];
                return (
                  <div
                    key={e}
                    className={pct > 0 ? 'bal' : 'bal zero'}
                    style={{ '--pct': `${pct}%` } as CSSProperties}
                  >
                    <span className={`bal-name el-${e}`}>{ELEMENT[e]![L]}</span>
                    <span className="bal-track">
                      <span className={`bal-fill bg-${e}`} />
                    </span>
                    <span className="bal-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
            <div className="card" style={{ marginTop: 10 }}>
              <div className="verdict">
                {UI.dayMaster[L]} {result.chart.dayMaster}
                {' · '}
                {term(result.strength.verdict, L)}
              </div>
              <details className="why">
                <summary>{UI.whyThis[L]}</summary>
                <ul className="reasoning">
                  {result.strength.reasoning.map((r, i) => (
                    <li key={i} className={r.startsWith('⚠️') ? 'warn' : undefined}>{r}</li>
                  ))}
                </ul>
              </details>
            </div>
            <div className="card">
              <div className="verdict">
                {UI.favourable[L]}{' '}
                <span className={`el-${result.yongShen.primary}`}>
                  {ELEMENT[result.yongShen.primary]![L]}
                </span>
                {result.yongShen.secondary && (
                  <>
                    {' · '}{UI.supporting[L]}{' '}
                    <span className={`el-${result.yongShen.secondary}`}>
                      {ELEMENT[result.yongShen.secondary]![L]}
                    </span>
                  </>
                )}
              </div>
              {/* The other three of the five: what works against the 用神, what
                  feeds that, and what is merely neutral. Named so a 闲神 luck
                  pillar can read as unremarkable rather than as a threat. */}
              <div className="gods-line">
                {result.yongShen.unfavourable[0] && (
                  <span>{UI.avoidLabel[L]}{' '}
                    <span className={`el-${result.yongShen.unfavourable[0]}`}>
                      {ELEMENT[result.yongShen.unfavourable[0]]![L]}
                    </span>
                  </span>
                )}
                {result.yongShen.unfavourable[1] && (
                  <span>{UI.foeLabel[L]}{' '}
                    <span className={`el-${result.yongShen.unfavourable[1]}`}>
                      {ELEMENT[result.yongShen.unfavourable[1]]![L]}
                    </span>
                  </span>
                )}
                {result.yongShen.neutral.length > 0 && (
                  <span>{UI.neutralLabel[L]}{' '}
                    {result.yongShen.neutral.map((e, i) => (
                      <span key={e} className={`el-${e}`}>{i > 0 ? '、' : ''}{ELEMENT[e]![L]}</span>
                    ))}
                  </span>
                )}
              </div>
              <details className="why">
                <summary>{UI.whyThis[L]}</summary>
                <ul className="reasoning">
                  {result.yongShen.reasoning.map((r, i) => (
                    <li key={i} className={r.startsWith('⚠️') ? 'warn' : undefined}>{r}</li>
                  ))}
                </ul>
              </details>
              <span className="school">{UI.methodUsed[L]}: {result.yongShen.school}</span>
            </div>
          </section>

          <section>
            <h2>{UI.luck[L]}</h2>
            <p className="scale-note">{UI.luckAgeScale[L]}</p>
            <div className="luck-scroll">
              <div className="luck">
                {result.career.decades.map((d) => (
                  <div className={`luck-cell v-${d.verdict}`} key={d.index}>
                    <div className="age">{d.startAge}</div>
                    <div className="gz">{d.ganZhi}</div>
                    <div className="age">{d.startYear}</div>
                    <div className="verdict-tag">
                      {DECADE_VERDICT[d.verdict]?.[L] ?? d.verdict}
                    </div>
                    <div className="bar" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {result.monthly.length > 0 && (
            <section>
              <h2>{UI.monthly[L]}{' · '}{result.monthly[0]!.year}</h2>
              <p className="scale-note">{UI.monthlyNote[L]}</p>
              <div className="luck-scroll annual-scroll">
                <div className="annual months">
                  {result.monthly.map((m) => (
                    <div className={`annual-cell luck-cell v-${m.verdict}${m.current ? ' now' : ''}`} key={m.index}>
                      <div className="age">{m.starts}</div>
                      <div className="gz">{m.ganZhi}</div>
                      <div className="tg">{TEN_GOD[m.stemTenGod]?.[L] ?? m.stemTenGod}</div>
                      <div className="tg dim">{TEN_GOD[m.branchTenGod]?.[L] ?? m.branchTenGod}</div>
                      <div className="verdict-tag">{DECADE_VERDICT[m.verdict]?.[L] ?? m.verdict}</div>
                      <div className="bar" />
                      {m.current && <div className="now-tag">{UI.monthlyNow[L]}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {result.annual.length > 0 && (
            <section>
              <h2>{UI.annual[L]}</h2>
              <p className="scale-note">{UI.annualNote[L]}</p>
              <div className="luck-scroll annual-scroll">
                <div className="annual">
                  {result.annual.map((a) => (
                    <div className={`annual-cell${a.current ? ' now' : ''}`} key={a.year}>
                      <div className="age">{a.year}</div>
                      <div className="gz">{a.ganZhi}</div>
                      <div className="age">{L === 'zh' ? `${a.age}岁` : `age ${a.age}`}</div>
                      <div className="tg">{TEN_GOD[a.stemTenGod]?.[L] ?? a.stemTenGod}</div>
                      <div className="tg dim">{TEN_GOD[a.branchTenGod]?.[L] ?? a.branchTenGod}</div>
                      {a.current && <div className="now-tag">{UI.annualNow[L]}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section>
            <h2>{UI.reading[L]}</h2>
            {/* Toggle buttons, not a role="tab" widget: the tab pattern owes a
                screen reader arrow-key navigation and an associated tabpanel,
                and this control has neither (it switches a whole topic, not one
                panel). aria-pressed is the honest, complete semantics here. */}
            <div className="tabs" role="group" aria-label={UI.reading[L]}>
              <button type="button" aria-pressed={tab === 'relationship'}
                onClick={() => switchTab('relationship')}>{UI.relationships[L]}</button>
              <button type="button" aria-pressed={tab === 'career'}
                onClick={() => switchTab('career')}>{UI.career[L]}</button>
            </div>

            <div className="questions">
              {topicTemplates.map((t) => (
                <button
                  key={t.id}
                  className="q-btn"
                  aria-pressed={activeTemplate === t.id}
                  disabled={readingBusy}
                  onClick={() => ask(t.id)}
                >
                  {t.question[L]}
                  <span className="q-hint">{t.hint[L]}</span>
                </button>
              ))}
            </div>

            {readingError && <p className="err" role="alert">{readingError}</p>}

            {(reading || readingBusy) && (
              <div className="card">
                <Reading text={reading} streaming={readingBusy} locale={L} />
                {!readingBusy && reading && <TermsUsed text={reading} locale={L} />}
                {readingSource === 'composed' && !readingBusy && (
                  <p className="caveat">
                    {UI.writtenBy[L]} {UI.composedLabel[L]}. {UI.modelHint[L]}
                  </p>
                )}
                {grounding && (
                  <div className={`grounded${grounding.ok ? '' : ' bad'}`}>
                    {grounding.ok
                      ? `✓ ${grounding.cited.length} ${UI.groundedOk[L]}`
                      : `⚠️ ${grounding.invalid.length} ${UI.groundedBadPrefix[L]}${grounding.invalid.join(', ')}`}
                  </div>
                )}
              </div>
            )}
          </section>

          {tab === 'relationship' ? (
            <>
              <Forecast birth={lastInput.current} locale={L} />
              <Compatibility selfBirth={lastInput.current} locale={L} />
            </>
          ) : (
            /* The two sections above are relationship-only; someone who opened
               Career first should still learn they exist. */
            <p className="remembered">
              {UI.underRelationships[L]}
              <button type="button" className="linkish" onClick={() => switchTab('relationship')}>
                {UI.goRelationships[L]}
              </button>
            </p>
          )}

          <section>
            <h2>
              {tab === 'relationship' ? UI.relationships[L] : UI.career[L]}
              {' · '}
              {UI.findings[L]}
            </h2>
            <div className="card">
              <FindingList
                findings={tab === 'relationship'
                  ? result.relationship.findings
                  : result.career.findings}
                locale={L}
              />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
