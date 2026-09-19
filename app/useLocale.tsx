'use client';

import { useEffect, useState } from 'react';
import { htmlLang, isLocale, type Locale } from '../src/i18n/text';

/**
 * The remembered language, read synchronously. Anything that fetches on
 * mount must use this rather than the hook's state, which is still the
 * server default ('zh') in the same effect pass — the page would flip to
 * English while the data it had just asked for arrived in Chinese.
 */
export function savedLocale(): Locale {
  try {
    const saved = window.localStorage.getItem('bazi_locale');
    if (isLocale(saved)) return saved;
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch { return 'zh'; }
}

/** The same remembered language the 八字 page uses, shared by the other routes. */
export function useLocale(): [Locale, (next: Locale) => void] {
  const [locale, setLocale] = useState<Locale>('zh');
  useEffect(() => { setLocale(savedLocale()); }, []);
  useEffect(() => { document.documentElement.lang = htmlLang(locale); }, [locale]);
  const change = (next: Locale) => {
    setLocale(next);
    try { window.localStorage.setItem('bazi_locale', next); } catch { /* ignore */ }
  };
  return [locale, change];
}

export function LangSwitch({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="lang" role="group" aria-label="Language">
      <button type="button" aria-pressed={locale === 'zh'} onClick={() => onChange('zh')}>中文</button>
      <button type="button" aria-pressed={locale === 'en'} onClick={() => onChange('en')}>EN</button>
    </div>
  );
}
