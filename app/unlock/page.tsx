'use client';

/**
 * PIN screen.
 *
 * Built for a thumb: a numeric keypad rather than a text field, big targets,
 * and it submits itself the moment the fourth digit lands so there is no
 * "now press the button" step. `inputMode="numeric"` is set on the hidden
 * field too, so a hardware keyboard and a paste both still work.
 */

import { useEffect, useRef, useState } from 'react';

const PIN_LENGTH = 4;

export default function Unlock() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

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
        setError(json.error ?? '通行码不对。');
        setPin('');
      } catch {
        setError('无法连线，请稍后再试。');
        setPin('');
      } finally {
        setBusy(false);
        submitting.current = false;
      }
    })();
  }, [pin]);

  const press = (digit: string) =>
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + digit));

  return (
    <main className="gate">
      <div className="gate-inner">
        <h1>八字排盘</h1>
        <p className="gate-sub">请输入通行码</p>

        <div className="dots" aria-label={`已输入 ${pin.length} 位`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={`dot${i < pin.length ? ' filled' : ''}`} />
          ))}
        </div>

        {error && <p className="gate-err">{error}</p>}

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} onClick={() => press(d)} disabled={busy}>{d}</button>
          ))}
          <button className="ghost" onClick={() => setPin('')} disabled={busy}>清除</button>
          <button onClick={() => press('0')} disabled={busy}>0</button>
          <button
            className="ghost"
            onClick={() => setPin((p) => p.slice(0, -1))}
            disabled={busy}
            aria-label="删除"
          >
            ⌫
          </button>
        </div>

        {busy && <p className="gate-sub">验证中…</p>}
      </div>
    </main>
  );
}
