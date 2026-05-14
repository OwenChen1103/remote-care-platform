import type { Metadata } from 'next';
import { Noto_Sans_TC } from 'next/font/google';
import './globals.css';

// Same family the mobile app uses (apps/mobile/lib/theme.ts).
// Variable form so Tailwind's `font-sans` can reference it via CSS var.
const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-noto-sans-tc',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WhoCares 管理後台',
  description: 'WhoCares 遠端照護平台管理後台',
  icons: {
    icon: '/brand/whocares-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={notoSansTC.variable}>
      <body className="bg-surface-subtle font-sans text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
