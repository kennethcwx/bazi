'use client';

/**
 * PIN screen.
 *
 * Built for a thumb: a numeric keypad rather than a text field, big targets,
 * and it submits itself the moment the fourth digit lands so there is no
 * "now press the button" step.
 */

import { useEffect, useRef, useState } from 'react';
import { UI } from '../../src/i18n/ui';
import { isLocale, type Locale } from '../../src/i18n/text';

const PIN_LENGTH = 4;

export default function Unlock() {
  const [locale, setLocale] = useState<Locale>('zh');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  // Match the language the main page will use, so the gate is not the one
  // Chinese-only screen in an English session.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('bazi_locale');
      if (isLocale(saved)) setLocale(saved);
      else if (!navigator.language.toLowerCase().startsWith('zh')) setLocale('en');
    } catch { /* storage unavailable; keep the default */ }
  }, []);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch('/api/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        if (res.ok) {
          // Full reload so middleware sees the new cookie.
          window.location.replace('/');
          return;
        }
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? UI.pinWrong[locale]);
        setPin('');
      } catch {
        setError(UI.errConnect[locale]);
        setPin('');
      } finally {
        setBusy(false);
        submitting.current = false;
      }
    })();
  }, [pin, locale]);

  const press = (digit: string) =>
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + digit));

  return (
    <main className="gate">
      <div className="gate-inner">
        <h1>{UI.title[locale]}</h1>
        <p className="gate-sub">{UI.enterPin[locale]}</p>

        <div className="dots" aria-label={`${pin.length}/${PIN_LENGTH}`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={`dot${i < pin.length ? ' filled' : ''}`} />
          ))}
        </div>

        {error && <p className="gate-err">{error}</p>}

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} onClick={() => press(d)} disabled={busy}>{d}</button>
          ))}
          <button className="ghost" onClick={() => setPin('')} disabled={busy}>{UI.clear[locale]}</button>
          <button onClick={() => press('0')} disabled={busy}>0</button>
          <button
            className="ghost"
            onClick={() => setPin((p) => p.slice(0, -1))}
            disabled={busy}
            aria-label={locale === "zh" ? "删除" : "Delete"}
          >
            ⌫
          </button>
        </div>

        {busy && <p className="gate-sub">{UI.verifying[locale]}</p>}
      </div>
    </main>
  );
}
