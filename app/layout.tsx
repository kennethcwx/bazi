import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: '八字排盘 · 姻缘与事业',
  description: '可核对的八字排盘，与姻缘、事业两个主题的推断。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
