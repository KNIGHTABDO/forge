import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Manrope, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme-context';
import './globals.css';
import './home.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FORGE — Build Apps With One Sentence',
  description: 'Describe your idea in one sentence. Get a fully working interactive web app instantly. No code. No limits.',
  openGraph: {
    title: 'FORGE — Build Apps With One Sentence',
    description: 'Describe your idea. Get a fully working interactive web app instantly.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#fffcf7',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
