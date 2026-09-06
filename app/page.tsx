'use client';

/**
 * The one screen.
 *
 * Order is the argument: the chart comes first because it is the thing a
 * practitioner checks, then how it was derived (旺衰, 用神, with the school
 * named), then the luck timeline, and only then the readings. Putting the
 * conclusions last is deliberate — they are downstream of everything above,
 * and the layout should say so.
 */

import { useState, type FormEvent } from 'react';
import type { Chart, Element, Pillar } from '../src/engine/types';
import { formatNote, isCaveat } from '../src/i18n/notes';
import type { Finding } from '../src/analyzer/findings';
import type { StrengthAnalysis } from '../src/analyzer/strength';
import type { YongShenAnalysis } from '../src/analyzer/yongshen';
import type { DecadeOutlook } from '../src/analyzer/topics/career';

interface Result {
  chart: Chart;
  strength: StrengthAnalysis;
  yongShen: YongShenAnalysis;
  relationship: { findings: Finding[]; primaryStar: string };
  career: { findings: Finding[]; decades: DecadeOutlook[]; structure: string; lean: string };
}

const POSITION: Record<string, string> = {
  year: '年柱', month: '月柱', day: '日柱', hour: '时柱',
};

/** A few defaults so the field is not a chore. Longitude drives 真太阳时. */
const PLACES = [
  { label: '新加坡', tz: 'Asia/Singapore', lon: 103.82 },
  { label: '吉隆坡', tz: 'Asia/Kuala_Lumpur', lon: 101.69 },
  { label: '香港', tz: 'Asia/Hong_Kong', lon: 114.17 },
  { label: '台北', tz: 'Asia/Taipei', lon: 121.56 },
  { label: '北京', tz: 'Asia/Shanghai', lon: 116.41 },
  { label: '上海', tz: 'Asia/Shanghai', lon: 121.47 },
  { label: '广州', tz: 'Asia/Shanghai', lon: 113.26 },
  { label: '伦敦', tz: 'Europe/London', lon: -0.13 },
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
      {p.isVoid && <span className="void">空亡</span>}
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
      <div className="meta">{p.naYin} · {p.terrain}</div>
    </div>
  );
}

function FindingList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return <p className="audit">没有可报告的结论。</p>;
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
  const [tab, setTab] = useState<'relationship' | 'career'>('relationship');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const date = String(fd.get('date') ?? '');
    const time = String(fd.get('time') ?? '');
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time ? time.split(':').map(Number) : [undefined, undefined];
    const p = PLACES[place]!;

    try {
      const res = await fetch('/api/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: y, month: mo, day: d,
          ...(timeKnown && h !== undefined ? { hour: h, minute: mi ?? 0 } : {}),
          timeZone: p.tz,
          longitude: p.lon,
          gender: fd.get('gender'),
          useTrueSolarTime: trueSolar,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? '排盘失败。'); setResult(null); }
      else setResult(json as Result);
    } catch {
      setError('无法连线，请稍后再试。');
    } finally {
      setBusy(false);
    }
  }

  const elements: Element[] = ['木', '火', '土', '金', '水'];

  return (
    <main className="wrap">
      <h1>八字排盘</h1>
      <p className="sub">
        可核对的排盘，与姻缘、事业两个主题的推断。每一条结论都附上它所依据的命理事实。
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
        <div>
          <label>&nbsp;</label>
          <button type="submit" disabled={busy}>{busy ? '排盘中…' : '排盘'}</button>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span className="checkline">
            <input id="tk" type="checkbox" checked={timeKnown}
              onChange={(e) => setTimeKnown(e.target.checked)} />
            <label htmlFor="tk" style={{ margin: 0 }}>知道出生时辰</label>
          </span>
          <span className="checkline">
            <input id="ts" type="checkbox" checked={trueSolar}
              onChange={(e) => setTrueSolar(e.target.checked)} disabled={!timeKnown} />
            <label htmlFor="ts" style={{ margin: 0 }}>使用真太阳时（各派做法不同）</label>
          </span>
        </div>
      </form>

      {error && <p className="err">{error}</p>}

      {result && (
        <>
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
                    {pct >= 8 ? `${e} ${pct}%` : e}
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
          </section>

          <section>
            <h2>推断</h2>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'relationship'}
                onClick={() => setTab('relationship')}>姻缘 · 婚姻</button>
              <button role="tab" aria-selected={tab === 'career'}
                onClick={() => setTab('career')}>事业 · 财运</button>
            </div>
            <div className="card">
              <FindingList
                findings={tab === 'relationship'
                  ? result.relationship.findings
                  : result.career.findings}
              />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
