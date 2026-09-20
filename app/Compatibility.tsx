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
import { activeSlot, loadPartnerAt, savePartnerAt, setActiveSlot, SLOTS, type SavedBirth, type Slot } from '../src/storage';
import { PlacePicker } from './PlacePicker';
import { useAbort } from './useAbort';
import { PLACES, DEFAULT_PLACE } from '../src/places';

interface CompatData {
  self: { pillars: (string | null)[]; dayMaster: string; favourable: string[] };
  partner: { pillars: (string | null)[]; dayMaster: string; favourable: string[] };
  supplyToSelf: number;
  supplyToPartner: number;
  findings: RenderedFinding[];
}

export function Compatibility({ selfBirth, locale }: {
  selfBirth: Record<string, unknown> | null;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  /** Which of the two remembered partners the form and the reading are about. */
  const [slot, setSlot] = useState<Slot>(0);
  const [records, setRecords] = useState<(SavedBirth | null)[]>([null, null]);
  const saved = records[slot] ?? null;
  const [place, setPlace] = useState(DEFAULT_PLACE);
  const [timeKnown, setTimeKnown] = useState(true);
  // Controlled, for the same reason the main form is: remembered details
  // arrive after mount, and defaultValue is read once and never again. It
  // happened to work here only because the form mounts lazily — which is luck,
  // not design, and would break the moment this section opened by default.
  const [pname, setPname] = useState('');
  const [pdate, setPdate] = useState('');
  const [ptime, setPtime] = useState('');
  const [pgender, setPgender] = useState<'male' | 'female'>('female');
  const [data, setData] = useState<CompatData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = useAbort();

  /** Put a remembered partner in the form. */
  function fill(p: SavedBirth | null) {
    setPlace(p?.placeIndex ?? DEFAULT_PLACE);
    setTimeKnown(p?.timeKnown ?? true);
    setPname(p?.label ?? '');
    setPdate(p?.date ?? '');
    setPtime(p?.time ?? '');
    setPgender(p?.gender ?? 'female');
  }

  useEffect(() => {
    const all = SLOTS.map((i) => loadPartnerAt(i));
    const active = activeSlot();
    setRecords(all);
    setSlot(active);
    fill(all[active] ?? null);
    // A remembered partner compares at once; the tap the button asked for
    // only ever had one answer.
    if (all[active]) void compare(all[active]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Switch slots: a remembered partner compares at once, an empty one opens the form. */
  function switchSlot(next: Slot) {
    if (next === slot) return;
    setSlot(next);
    setActiveSlot(next);
    setData(null);
    setError(null);
    const p = records[next] ?? null;
    fill(p);
    if (p) void compare(p);
    else setOpen(true);
  }

  function toRecord(): SavedBirth {
    return {
      date: pdate, time: ptime, gender: pgender,
      placeIndex: place, timeKnown, useTrueSolarTime: true,
      label: pname,
    };
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const record = toRecord();
    savePartnerAt(slot, record);
    setRecords((r) => r.map((x, i) => (i === slot ? record : x)));
    await compare(record);
  }

  async function compare(record: SavedBirth) {
    if (!selfBirth) return;
    const p = PLACES[record.placeIndex]!;
    const [y, mo, d] = record.date.split('-').map(Number);
    const [h, mi] = record.time ? record.time.split(':').map(Number) : [undefined, undefined];

    const signal = next();
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
            ...(record.timeKnown && h !== undefined ? { hour: h, minute: mi ?? 0 } : {}),
            timeZone: p.tz, longitude: p.lon, gender: record.gender,
            useTrueSolarTime: true,
          },
          locale,
        }),
        signal,
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? UI.errCast[locale]); setData(null); }
      else setData(json as CompatData);
    } catch {
      if (signal.aborted) return;
      setError(UI.errConnect[locale]);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <details className="acc" open>
      <summary><h2>{UI.compatibility[locale]}</h2></summary>

      <div className="tabs" role="group" aria-label={UI.partnerSlot[locale]}>
        {SLOTS.map((i) => (
          <button key={i} type="button" aria-pressed={slot === i} onClick={() => switchSlot(i)}>
            {UI.partnerSlot[locale]} {i + 1} · {records[i]?.label || (records[i] ? records[i]!.date : UI.partnerEmptySlot[locale])}
          </button>
        ))}
      </div>

      {!open && !data && (
        <button className="q-btn" onClick={() => setOpen(true)} disabled={!selfBirth}>
          {saved
            ? `${UI.comparePartner[locale]}${saved.label ? ` — ${saved.label}` : ''}`
            : UI.addPartner[locale]}
          <span className="q-hint">
            {saved
              ? `${saved.date}${saved.time && saved.timeKnown ? ` ${saved.time}` : ''} · ${UI.rememberedShort[locale]}`
              : UI.addPartnerHint[locale]}
          </span>
        </button>
      )}

      {(open || data) && (
        <form onSubmit={submit} style={{ marginBottom: 12 }}>
          <div className="field-wide">
            <label htmlFor="pname">{UI.partnerName[locale]}</label>
            <input id="pname" name="pname" type="text" value={pname}
              onChange={(e) => setPname(e.target.value)}
              placeholder={UI.partnerNamePlaceholder[locale]} />
          </div>
          <div>
            <label htmlFor="pdate">{UI.birthDate[locale]}</label>
            <input id="pdate" name="pdate" type="date" required
              value={pdate} onChange={(e) => setPdate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ptime">{UI.birthTime[locale]}</label>
            <input id="ptime" name="ptime" type="time" disabled={!timeKnown}
              value={ptime} onChange={(e) => setPtime(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pgender">{UI.gender[locale]}</label>
            <select id="pgender" name="pgender" value={pgender}
              onChange={(e) => setPgender(e.target.value as 'male' | 'female')}>
              <option value="male">{UI.male[locale]}</option>
              <option value="female">{UI.female[locale]}</option>
            </select>
          </div>
          <PlacePicker id="pplace" value={place} onChange={setPlace} locale={locale} />
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
                <details className="why">
                  <summary>{UI.showEvidence[locale]}</summary>
                  <ul className="ev">
                    {f.evidence.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        </>
      )}
    </details>
  );
}
