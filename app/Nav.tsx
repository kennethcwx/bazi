'use client';

/**
 * Three destinations, one bar. Plain links rather than a router-aware tab
 * widget: each page is its own route with its own state, and a full
 * navigation is exactly what switching between them should be.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '../src/i18n/text';

// Stroke icons on currentColor so the active tint is one CSS rule. Four
// pillars, a natal wheel, a card: the thing each page draws.
const ICONS = {
  bazi: <><rect x="3" y="4" width="3" height="16" rx="1" /><rect x="8" y="4" width="3" height="16" rx="1" /><rect x="13" y="4" width="3" height="16" rx="1" /><rect x="18" y="4" width="3" height="16" rx="1" /></>,
  natal: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21" /></>,
  tarot: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M12 8l1.6 2.6L16 12l-2.4 1.4L12 16l-1.6-2.6L8 12l2.4-1.4z" /></>,
};

const LINKS = [
  { href: '/', zh: '八字', en: 'BaZi', icon: 'bazi' },
  { href: '/horoscope', zh: '星盘', en: 'Natal', icon: 'natal' },
  { href: '/tarot', zh: '塔罗', en: 'Tarot', icon: 'tarot' },
] as const;

export default function Nav({ locale }: { locale: Locale }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label={locale === 'zh' ? '主导航' : 'Main'}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            {ICONS[l.icon]}
          </svg>
          <span>{l[locale]}</span>
        </Link>
      ))}
    </nav>
  );
}
