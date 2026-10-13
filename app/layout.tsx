import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { BRAND, TAGLINE } from '@/lib/brand';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: `${BRAND} · ${TAGLINE}`,
  description: 'Private-seller cars priced against Manheim MMR.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0b1730' },
    { media: '(prefers-color-scheme: dark)', color: '#070d1a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
