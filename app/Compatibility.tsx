'use client';

/**
 * 合婚 — the partner chart and the two read against each other.
 *
 * The two supply figures are shown side by side rather than averaged into one
 * score. Compatibility is not symmetric, and a single number hides the most
 * actionable thing the reading has to say: which direction the benefit runs.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { UI } from '../src/i18n/ui';
import { ELEMENT } from '../src/i18n/glossary';
import type { Locale } from '../src/i18n/text';
import type { RenderedFinding } from '../src/analyzer/findings';
import { loadPartner, savePartner, type SavedBirth } from '../src/storage';

interface CompatData {
  self: { pillars: (string | null)[]; dayMaster: string; favourable: string[] };
  partner: { pillars: (string | null)[]; dayMaster: string; favourable: string[] };
  supplyToSelf: number;
  supplyToPartner: number;
  findings: RenderedFinding[];
}

export function Compatibility({ selfBirth, places, locale }: {
  selfBirth: Record<string, unknown> | null;
  places: readonly { zh: string; en: string; tz: string; lon: number }[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedBirth | null>(null);
  const [place, setPlace] = useState(0);
  const [timeKnown, setTimeKnown] = useState(true);
  const [data, setData] = useState<CompatData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = loadPartner();
    if (p) { setSaved(p); setPlace(p.placeIndex); setTimeKnown(p.timeKnown); }
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selfBirth) return;

    const fd = new FormData(e.currentTarget);
    const date = String(fd.get('pdate') ?? '');
    const time = String(fd.get('ptime') ?? '');
    const gender = String(fd.get('pgender') ?? 'female') as 'male' | 'female';
    const p = places[place]!;

    const record: SavedBirth = {
      date, time, gender, placeIndex: place, timeKnown,
      useTrueSolarTime: true,
      label: String(fd.get('pname') ?? ''),
    };
    savePartner(record);
    setSaved(record);

    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time ? time.split(':').map(Number) : [undefined, undefined];

    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          self: selfBirth,
          partner: {
            year: y, month: mo, day: d,
            ...(timeKnown && h !== undefined ? { hour: h, minute: mi ?? 0 } : {}),
            timeZone: p.tz, longitude: p.lon, gender,
            useTrueSolarTime: true,
          },
          locale,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? UI.errCast[locale]); setData(null); }
      else setData(json as CompatData);
    } catch {
      setError(UI.errConnect[locale]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>{UI.compatibility[locale]}</h2>

      {!open && !data && (
        <button className="q-btn" onClick={() => setOpen(true)} disabled={!selfBirth}>
          {UI.addPartner[locale]}
          <span className="q-hint">{UI.addPartnerHint[locale]}</span>
        </button>
      )}

      {(open || data) && (
        <form onSubmit={submit} style={{ marginBottom: 12 }}>
          <div className="field-wide">
            <label htmlFor="pname">{UI.partnerName[locale]}</label>
            <input id="pname" name="pname" type="text" defaultValue={saved?.label ?? ''}
              placeholder={UI.partnerNamePlaceholder[locale]} />
          </div>
          <div>
            <label htmlFor="pdate">{UI.birthDate[locale]}</label>
            <input id="pdate" name="pdate" type="date" required defaultValue={saved?.date ?? ''} />
          </div>
          <div>
            <label htmlFor="ptime">{UI.birthTime[locale]}</label>
            <input id="ptime" name="ptime" type="time" defaultValue={saved?.time ?? ''}
              disabled={!timeKnown} />
          </div>
          <div>
            <label htmlFor="pgender">{UI.gender[locale]}</label>
            <select id="pgender" name="pgender" defaultValue={saved?.gender ?? 'female'}>
              <option value="male">{UI.male[locale]}</option>
              <option value="female">{UI.female[locale]}</option>
            </select>
          </div>
          <div>
            <label htmlFor="pplace">{UI.birthPlace[locale]}</label>
            <select id="pplace" value={place} onChange={(e) => setPlace(Number(e.target.value))}>
              {places.map((p, i) => <option key={p.tz + p.lon} value={i}>{p[locale]}</option>)}
            </select>
          </div>
          <div className="checks">
            <span className="checkline">
              <input id="ptk" type="checkbox" checked={timeKnown}
                onChange={(e) => setTimeKnown(e.target.checked)} />
              <label htmlFor="ptk">{UI.knowTime[locale]}</label>
            </span>
          </div>
          <div className="field-wide">
            <button type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? UI.casting[locale] : UI.compare[locale]}
            </button>
          </div>
        </form>
      )}

      {error && <p className="err">{error}</p>}

      {data && (
        <>
          <div className="card">
            <div className="supply">
              <div className="supply-side">
                <div className="supply-label">{UI.theyGiveYou[locale]}</div>
                <div className="supply-num">{data.supplyToSelf}%</div>
                <div className="supply-note">
                  {data.self.favourable.map((e) => ELEMENT[e]?.[locale] ?? e).join(' · ')}
                </div>
              </div>
              <div className="supply-side">
                <div className="supply-label">{UI.youGiveThem[locale]}</div>
                <div className="supply-num">{data.supplyToPartner}%</div>
                <div className="supply-note">
                  {data.partner.favourable.map((e) => ELEMENT[e]?.[locale] ?? e).join(' · ')}
                </div>
              </div>
            </div>
            <p className="caveat" style={{ marginTop: 12 }}>{UI.supplyExplainer[locale]}</p>
          </div>

          <div className="card">
            <div className="two-charts">
              <div>
                <div className="chart-label">{UI.you[locale]}</div>
                <div className="chart-gz">
                  {data.self.pillars.map((p, i) => <span key={i}>{p ?? '——'}</span>)}
                </div>
              </div>
              <div>
                <div className="chart-label">{saved?.label || UI.them[locale]}</div>
                <div className="chart-gz">
                  {data.partner.pillars.map((p, i) => <span key={i}>{p ?? '——'}</span>)}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            {data.findings.map((f) => (
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
          </div>
        </>
      )}
    </section>
  );
}
