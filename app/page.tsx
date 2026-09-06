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

import { useState, useRef, useEffect, useCallback, type ReactNode, type FormEvent } from 'react';
import type { Chart, Element, Pillar } from '../src/engine/types';
import type { RenderedFinding } from '../src/analyzer/findings';
import { formatNote, formatLuckStart, isCaveat } from '../src/i18n/notes';
import { UI } from '../src/i18n/ui';
import { ELEMENT, TEN_GOD, TERRAIN, DECADE_VERDICT, term } from '../src/i18n/glossary';
import { isLocale, type Locale } from '../src/i18n/text';
import { TEMPLATES } from '../src/narrator/templates';

interface DecadeView {
  index: number; startAge: number; endAge: number;
  startYear: number; endYear: number; ganZhi: string;
  score: number; verdict: string; notes: string[];
}

interface Result {
  locale: Locale;
  chart: Chart;
  strength: {
    elementPercent: Record<Element, number>;
    supportPercent: number;
    verdict: string;
    reasoning: string[];
  };
  yongShen: {
    primary: Element;
    secondary: Element | null;
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

/** Longitude drives 真太阳时, so each place carries one. */
const PLACES = [
  { zh: '新加坡', en: 'Singapore', tz: 'Asia/Singapore', lon: 103.82 },
  { zh: '吉隆坡', en: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur', lon: 101.69 },
  { zh: '槟城', en: 'Penang', tz: 'Asia/Kuala_Lumpur', lon: 100.33 },
  { zh: '香港', en: 'Hong Kong', tz: 'Asia/Hong_Kong', lon: 114.17 },
  { zh: '台北', en: 'Taipei', tz: 'Asia/Taipei', lon: 121.56 },
  { zh: '台中', en: 'Taichung', tz: 'Asia/Taipei', lon: 120.68 },
  { zh: '北京', en: 'Beijing', tz: 'Asia/Shanghai', lon: 116.41 },
  { zh: '上海', en: 'Shanghai', tz: 'Asia/Shanghai', lon: 121.47 },
  { zh: '广州', en: 'Guangzhou', tz: 'Asia/Shanghai', lon: 113.26 },
  { zh: '雅加达', en: 'Jakarta', tz: 'Asia/Jakarta', lon: 106.85 },
  { zh: '曼谷', en: 'Bangkok', tz: 'Asia/Bangkok', lon: 100.5 },
  { zh: '伦敦', en: 'London', tz: 'Europe/London', lon: -0.13 },
  { zh: '悉尼', en: 'Sydney', tz: 'Australia/Sydney', lon: 151.21 },
  { zh: '纽约', en: 'New York', tz: 'America/New_York', lon: -74.01 },
];

function PillarCard({ p, position, locale }: {
  p: Pillar | null; position: keyof typeof PILLAR_KEY; locale: Locale;
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
      <div className="meta">{p.naYin}·{TERRAIN[p.terrain]?.[locale] ?? p.terrain}</div>
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
      blocks.push(<p className="cite" key={key++}>{line}</p>);
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
          <ul className="ev">
            {f.evidence.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      ))}
    </>
  );
}

export default function Page() {
  const [locale, setLocale] = useState<Locale>('zh');
  const [place, setPlace] = useState(0);
  const [timeKnown, setTimeKnown] = useState(true);
  const [trueSolar, setTrueSolar] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Topic>('relationship');

  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [reading, setReading] = useState('');
  const [readingBusy, setReadingBusy] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  /** True when the failure is a missing API key — a setup state, not a fault. */
  const [readingIsSetup, setReadingIsSetup] = useState(false);
  const [grounding, setGrounding] = useState<Grounding | null>(null);

  /** The birth payload that produced the current chart, reused for readings. */
  const lastInput = useRef<Record<string, unknown> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Remember the language choice. Wrapped because storage throws in some
  // privacy modes, and a language toggle is not worth a blank page.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('bazi_locale');
      if (isLocale(saved)) setLocale(saved);
      else if (!navigator.language.toLowerCase().startsWith('zh')) setLocale('en');
    } catch { /* storage unavailable; keep the default */ }
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
    setReadingIsSetup(false);
  }

  function switchTab(next: Topic) {
    if (next === tab) return;
    setTab(next);
    clearReading();
  }

  function readForm(form: HTMLFormElement) {
    const fd = new FormData(form);
    const [y, mo, d] = String(fd.get('date') ?? '').split('-').map(Number);
    const time = String(fd.get('time') ?? '');
    const [h, mi] = time ? time.split(':').map(Number) : [undefined, undefined];
    const p = PLACES[place]!;
    return {
      year: y, month: mo, day: d,
      ...(timeKnown && h !== undefined ? { hour: h, minute: mi ?? 0 } : {}),
      timeZone: p.tz,
      longitude: p.lon,
      gender: fd.get('gender'),
      useTrueSolarTime: trueSolar,
    };
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearReading();
    const payload = readForm(e.currentTarget);
    lastInput.current = payload;
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
        // A missing key is a deployment that is not finished, not a fault in
        // the request — say so quietly rather than in red.
        setReadingIsSetup(json.code === 'no_api_key');
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

          if (event === 'delta') {
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
          <input id="date" name="date" type="date" required defaultValue="1990-06-15" />
        </div>
        <div>
          <label htmlFor="time">{UI.birthTime[L]}</label>
          <input id="time" name="time" type="time" defaultValue="14:30" disabled={!timeKnown} />
        </div>
        <div>
          <label htmlFor="gender">{UI.gender[L]}</label>
          <select id="gender" name="gender" defaultValue="male">
            <option value="male">{UI.male[L]}</option>
            <option value="female">{UI.female[L]}</option>
          </select>
        </div>
        <div>
          <label htmlFor="place">{UI.birthPlace[L]}</label>
          <select id="place" value={place} onChange={(e) => setPlace(Number(e.target.value))}>
            {PLACES.map((p, i) => <option key={p.tz + p.lon} value={i}>{p[L]}</option>)}
          </select>
        </div>

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

      {error && <p className="err">{error}</p>}

      {result && (
        <div ref={resultsRef}>
          <section>
            <h2>{UI.pillars[L]}</h2>
            <div className="pillars">
              <PillarCard p={result.chart.pillars.year} position="year" locale={L} />
              <PillarCard p={result.chart.pillars.month} position="month" locale={L} />
              <PillarCard p={result.chart.pillars.day} position="day" locale={L} />
              <PillarCard p={result.chart.pillars.hour} position="hour" locale={L} />
            </div>
          </section>

          <section>
            <h2>{UI.basis[L]}</h2>
            <div className="card">
              <ul className="audit">
                {result.chart.moment.notes.map((n, i) => (
                  <li key={i} className={isCaveat(n) ? 'warn' : undefined}>
                    {formatNote(n, L)}
                  </li>
                ))}
                <li>
                  {UI.chartedAt[L]} {result.chart.moment.charted.year}-
                  {String(result.chart.moment.charted.month).padStart(2, '0')}-
                  {String(result.chart.moment.charted.day).padStart(2, '0')}{' '}
                  {String(result.chart.moment.charted.hour).padStart(2, '0')}:
                  {String(result.chart.moment.charted.minute).padStart(2, '0')}
                </li>
                <li>{formatLuckStart(result.chart.luckStart, result.chart.luckForward, L)}</li>
              </ul>
            </div>
          </section>

          <section>
            <h2>{UI.balance[L]}</h2>
            <div className="balance">
              {elements.map((e) => {
                const pct = result.strength.elementPercent[e];
                return pct > 0 ? (
                  <div key={e} className={`bg-${e}`} style={{ width: `${pct}%` }}>
                    {pct >= 12 ? `${ELEMENT[e]![L]} ${pct}%` : `${pct}%`}
                  </div>
                ) : null;
              })}
            </div>
            <div className="card" style={{ marginTop: 10 }}>
              <div className="verdict">
                {UI.dayMaster[L]} {result.chart.dayMaster}
                {' · '}
                {term(result.strength.verdict, L)}
              </div>
              <ul className="reasoning">
                {result.strength.reasoning.map((r, i) => (
                  <li key={i} className={r.startsWith('⚠️') ? 'warn' : undefined}>{r}</li>
                ))}
              </ul>
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
              <ul className="reasoning">
                {result.yongShen.reasoning.map((r, i) => (
                  <li key={i} className={r.startsWith('⚠️') ? 'warn' : undefined}>{r}</li>
                ))}
              </ul>
              <span className="school">{UI.methodUsed[L]}: {result.yongShen.school}</span>
            </div>
          </section>

          <section>
            <h2>{UI.luck[L]}</h2>
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

          <section>
            <h2>{UI.reading[L]}</h2>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'relationship'}
                onClick={() => switchTab('relationship')}>{UI.relationships[L]}</button>
              <button role="tab" aria-selected={tab === 'career'}
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

            {readingError && (
              <p className={readingIsSetup ? 'setup' : 'err'}>{readingError}</p>
            )}

            {(reading || readingBusy) && (
              <div className="card">
                <Reading text={reading} streaming={readingBusy} locale={L} />
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
