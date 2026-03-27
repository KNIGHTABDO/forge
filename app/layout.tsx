import type { Metadata, Viewport } from 'next';
import { Fraunces, Plus_Jakarta_Sans, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './home.css';

/* Display / editorial serif — optically variable, gorgeous at large sizes */
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  style: ['normal', 'italic'],
  variable: '--font-headline',
  display: 'swap',
});

/* Clean geometric sans for body text */
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

/* Same font for --font-body alias */
const plusJakartaSansBody = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

/* Geometric sans for UI labels & nav */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-label',
  display: 'swap',
});

/* Monospace for code blocks */
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
  themeColor: '#FAFAF8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${fraunces.variable} ${plusJakartaSans.variable} ${plusJakartaSansBody.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
