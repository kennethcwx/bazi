'use client';

import { useEffect, useState } from 'react';
import { htmlLang, isLocale, type Locale } from '../src/i18n/text';

/** The same remembered language the 八字 page uses, shared by the other routes. */
export function useLocale(): [Locale, (next: Locale) => void] {
  const [locale, setLocale] = useState<Locale>('zh');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('bazi_locale');
      if (isLocale(saved)) setLocale(saved);
      else if (!navigator.language.toLowerCase().startsWith('zh')) setLocale('en');
    } catch { /* storage unavailable; keep the default */ }
  }, []);
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
