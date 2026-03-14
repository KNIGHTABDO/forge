import type { Metadata } from 'next';
import './globals.css';
import './home.css';

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
