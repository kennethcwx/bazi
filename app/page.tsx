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
 */

import { useState, useRef, type ReactNode, type FormEvent } from 'react';
import type { Chart, Element, Pillar } from '../src/engine/types';
import { formatNote, isCaveat } from '../src/i18n/notes';
import type { Finding } from '../src/analyzer/findings';
import type { StrengthAnalysis } from '../src/analyzer/strength';
import type { YongShenAnalysis } from '../src/analyzer/yongshen';
import type { DecadeOutlook } from '../src/analyzer/topics/career';
import { TEMPLATES } from '../src/narrator/templates';

interface Result {
  chart: Chart;
  strength: StrengthAnalysis;
  yongShen: YongShenAnalysis;
  relationship: { findings: Finding[]; primaryStar: string };
  career: { findings: Finding[]; decades: DecadeOutlook[]; structure: string; lean: string };
}

interface Grounding {
  cited: string[];
  invalid: string[];
  uncitedLeads: string[];
  ok: boolean;
}

type Topic = 'relationship' | 'career';

const POSITION: Record<string, string> = {
  year: '年柱', month: '月柱', day: '日柱', hour: '时柱',
};

/** Longitude drives 真太阳时, so each place carries one. */
const PLACES = [
  { label: '新加坡', tz: 'Asia/Singapore', lon: 103.82 },
  { label: '吉隆坡', tz: 'Asia/Kuala_Lumpur', lon: 101.69 },
  { label: '槟城', tz: 'Asia/Kuala_Lumpur', lon: 100.33 },
  { label: '香港', tz: 'Asia/Hong_Kong', lon: 114.17 },
  { label: '台北', tz: 'Asia/Taipei', lon: 121.56 },
  { label: '台中', tz: 'Asia/Taipei', lon: 120.68 },
  { label: '北京', tz: 'Asia/Shanghai', lon: 116.41 },
  { label: '上海', tz: 'Asia/Shanghai', lon: 121.47 },
  { label: '广州', tz: 'Asia/Shanghai', lon: 113.26 },
  { label: '雅加达', tz: 'Asia/Jakarta', lon: 106.85 },
  { label: '曼谷', tz: 'Asia/Bangkok', lon: 100.5 },
  { label: '伦敦', tz: 'Europe/London', lon: -0.13 },
  { label: '悉尼', tz: 'Australia/Sydney', lon: 151.21 },
  { label: '纽约', tz: 'America/New_York', lon: -74.01 },
];

function PillarCard({ p, position }: { p: Pillar | null; position: string }) {
  if (!p) {
    return (
      <div className="pillar unknown">
        <div className="pos">{POSITION[position]}</div>
        <div className="tengod">—</div>
        <div className="gz">——</div>
        <div className="hidden">时辰未知</div>
      </div>
    );
  }
  return (
    <div className={`pillar${position === 'day' ? ' is-day' : ''}`}>
      {p.isVoid && <span className="void">空</span>}
      <div className="pos">{POSITION[position]}</div>
      <div className="tengod">{p.tenGod ?? '日主'}</div>
      <div className="gz">
        <span className={`el-${p.stemElement}`}>{p.stem}</span>
        <span className={`el-${p.branchElement}`}>{p.branch}</span>
      </div>
      <div className="hidden">
        {p.hiddenStems.map((h) => (
          <div key={h.stem + h.role}>
            <span className={`el-${h.element}`}>{h.stem}</span> {h.tenGod}
          </div>
        ))}
      </div>
      <div className="meta">{p.naYin}·{p.terrain}</div>
    </div>
  );
}

/**
 * Render the narrator's output.
 *
 * The format is deliberately minimal — `### heading`, paragraphs, and a
 * `依据：` line per section — so this needs no markdown dependency and cannot
 * be used to inject markup.
 */
function Reading({ text, streaming }: { text: string; streaming: boolean }) {
  const blocks: ReactNode[] = [];
  let key = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('###')) {
      blocks.push(<h3 key={key++}>{line.replace(/^#+\s*/, '')}</h3>);
    } else if (/^依据[:：]/.test(line)) {
      blocks.push(<p className="cite" key={key++}>{line}</p>);
    } else {
      blocks.push(<p key={key++}>{line}</p>);
    }
  }

  return (
    <div className="reading">
      {blocks}
      {streaming && <span className="cursor" aria-label="生成中" />}
    </div>
  );
}

function FindingList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return <p className="note">没有可报告的结论。</p>;
  return (
    <>
      {findings.map((f) => (
        <div className="finding" key={f.id}>
          <div className="claim">
            {f.claim}
            <span className={`tag${f.confidence === 'low' ? ' low' : ''}`}>
              {f.confidence === 'high' ? '确' : f.confidence === 'medium' ? '中' : '存疑'}
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
  const [grounding, setGrounding] = useState<Grounding | null>(null);

  /** The birth payload that produced the current chart, reused for readings. */
  const lastInput = useRef<Record<string, unknown> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

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
    setBusy(true);
    setError(null);
    setReading('');
    setActiveTemplate(null);
    setGrounding(null);
    setReadingError(null);

    const payload = readForm(e.currentTarget);
    lastInput.current = payload;

    try {
      const res = await fetch('/api/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? '排盘失败。'); setResult(null); }
      else {
        setResult(json as Result);
        // On a phone the form fills the screen; bring the chart into view.
        requestAnimationFrame(() =>
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        );
      }
    } catch {
      setError('无法连线，请稍后再试。');
    } finally {
      setBusy(false);
    }
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
        body: JSON.stringify({ ...lastInput.current, templateId }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        setReadingError(json.error ?? '生成解读失败。');
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
            setReadingError(String(data['error'] ?? '生成解读失败。'));
          }
        }
      }
    } catch {
      setReadingError('连线中断，解读未完成。');
    } finally {
      setReadingBusy(false);
    }
  }

  const elements: Element[] = ['木', '火', '土', '金', '水'];
  const topicTemplates = TEMPLATES.filter((t) => t.topic === tab);

  return (
    <main className="wrap">
      <h1>八字排盘</h1>
      <p className="sub">
        可核对的排盘，与姻缘、事业两个主题的解读。每一句话都附上它所依据的命理事实。
      </p>

      <form onSubmit={submit}>
        <div>
          <label htmlFor="date">出生日期（公历）</label>
          <input id="date" name="date" type="date" required defaultValue="1990-06-15" />
        </div>
        <div>
          <label htmlFor="time">出生时间</label>
          <input id="time" name="time" type="time" defaultValue="14:30" disabled={!timeKnown} />
        </div>
        <div>
          <label htmlFor="gender">性别</label>
          <select id="gender" name="gender" defaultValue="male">
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>
        <div>
          <label htmlFor="place">出生地</label>
          <select id="place" value={place} onChange={(e) => setPlace(Number(e.target.value))}>
            {PLACES.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
          </select>
        </div>

        <div className="checks">
          <span className="checkline">
            <input id="tk" type="checkbox" checked={timeKnown}
              onChange={(e) => setTimeKnown(e.target.checked)} />
            <label htmlFor="tk">知道出生时辰</label>
          </span>
          <span className="checkline">
            <input id="ts" type="checkbox" checked={trueSolar}
              onChange={(e) => setTrueSolar(e.target.checked)} disabled={!timeKnown} />
            <label htmlFor="ts">使用真太阳时（各派做法不同）</label>
          </span>
        </div>

        <div className="field-wide">
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? '排盘中…' : '排盘'}
          </button>
        </div>
      </form>

      {error && <p className="err">{error}</p>}

      {result && (
        <div ref={resultsRef}>
          <section>
            <h2>四柱</h2>
            <div className="pillars">
              <PillarCard p={result.chart.pillars.year} position="year" />
              <PillarCard p={result.chart.pillars.month} position="month" />
              <PillarCard p={result.chart.pillars.day} position="day" />
              <PillarCard p={result.chart.pillars.hour} position="hour" />
            </div>
          </section>

          <section>
            <h2>排盘依据</h2>
            <div className="card">
              <ul className="audit">
                {result.chart.moment.notes.map((n, i) => (
                  <li key={i} className={isCaveat(n) ? 'warn' : undefined}>
                    {formatNote(n, 'zh')}
                  </li>
                ))}
                <li>
                  实际起盘时刻 {result.chart.moment.charted.year}-
                  {String(result.chart.moment.charted.month).padStart(2, '0')}-
                  {String(result.chart.moment.charted.day).padStart(2, '0')}{' '}
                  {String(result.chart.moment.charted.hour).padStart(2, '0')}:
                  {String(result.chart.moment.charted.minute).padStart(2, '0')}
                </li>
                <li>{result.chart.luckStartDescription}，大运{result.chart.luckForward ? '顺行' : '逆行'}</li>
              </ul>
            </div>
          </section>

          <section>
            <h2>五行强弱</h2>
            <div className="balance">
              {elements.map((e) => {
                const pct = result.strength.elementPercent[e];
                return pct > 0 ? (
                  <div key={e} className={`bg-${e}`} style={{ width: `${pct}%` }}>
                    {pct >= 10 ? `${e}${pct}%` : e}
                  </div>
                ) : null;
              })}
            </div>
            <div className="card" style={{ marginTop: 10 }}>
              <div className="verdict">
                日主{result.chart.dayMaster}（{result.chart.dayMasterYinYang}
                {result.chart.dayMasterElement}）· {result.strength.verdict}
              </div>
              <ul className="reasoning">
                {result.strength.reasoning.map((r, i) => (
                  <li key={i} className={r.startsWith('⚠️') ? 'warn' : undefined}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="verdict">
                用神 <span className={`el-${result.yongShen.primary}`}>{result.yongShen.primary}</span>
                {result.yongShen.secondary && (
                  <> · 喜神 <span className={`el-${result.yongShen.secondary}`}>{result.yongShen.secondary}</span></>
                )}
              </div>
              <ul className="reasoning">
                {result.yongShen.reasoning.map((r, i) => (
                  <li key={i} className={r.startsWith('⚠️') ? 'warn' : undefined}>{r}</li>
                ))}
              </ul>
              <span className="school">取用流派：{result.yongShen.school}</span>
            </div>
          </section>

          <section>
            <h2>大运</h2>
            <div className="luck-scroll">
              <div className="luck">
                {result.career.decades.map((d) => (
                  <div className={`luck-cell v-${d.verdict}`} key={d.index}>
                    <div className="age">{d.startAge}岁</div>
                    <div className="gz">{d.ganZhi}</div>
                    <div className="age">{d.startYear}</div>
                    <div className="bar" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h2>解读</h2>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'relationship'}
                onClick={() => setTab('relationship')}>姻缘 · 婚姻</button>
              <button role="tab" aria-selected={tab === 'career'}
                onClick={() => setTab('career')}>事业 · 财运</button>
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
                  {t.question}
                  <span className="q-hint">{t.hint}</span>
                </button>
              ))}
            </div>

            {readingError && <p className="err">{readingError}</p>}

            {(reading || readingBusy) && (
              <div className="card">
                <Reading text={reading} streaming={readingBusy} />
                {grounding && (
                  <div className={`grounded${grounding.ok ? '' : ' bad'}`}>
                    {grounding.ok
                      ? `✓ 全文 ${grounding.cited.length} 处引用均对应到已算出的结论`
                      : `⚠️ 有 ${grounding.invalid.length} 处引用不在结论清单中：${grounding.invalid.join('、')}`}
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h2>{tab === 'relationship' ? '姻缘' : '事业'} · 已算出的结论</h2>
            <div className="card">
              <FindingList
                findings={tab === 'relationship'
                  ? result.relationship.findings
                  : result.career.findings}
              />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
