'use client';

/**
 * Three destinations, one bar. Plain links rather than a router-aware tab
 * widget: each page is its own route with its own state, and a full
 * navigation is exactly what switching between them should be.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '../src/i18n/text';

const LINKS = [
  { href: '/', zh: '八字', en: 'BaZi' },
  { href: '/horoscope', zh: '星盘', en: 'Natal' },
  { href: '/tarot', zh: '塔罗', en: 'Tarot' },
] as const;

export default function Nav({ locale }: { locale: Locale }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label={locale === 'zh' ? '主导航' : 'Main'}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined}>
          {l[locale]}
        </Link>
      ))}
    </nav>
  );
}
