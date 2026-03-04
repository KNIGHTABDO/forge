import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FORGE — Your app in one sentence',
  description: 'Describe a tool. Get a working app. Share it instantly.',
  openGraph: {
    title: 'FORGE',
    description: 'Describe a tool. Get a working app. Share it instantly.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
