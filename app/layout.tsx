import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: '八字 · 星盘 · 塔罗',
  description: '可核对的八字排盘与姻缘、事业推断，加上西洋星盘与塔罗。',
};

/**
 * `viewportFit: 'cover'` lets the layout reach under the iPhone notch and home
 * indicator; the padding that keeps content clear of them is in globals.css
 * via env(safe-area-inset-*). `themeColor` paints the Safari chrome to match
 * the page instead of leaving a white bar above a dark layout.
 */
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#12100e',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
