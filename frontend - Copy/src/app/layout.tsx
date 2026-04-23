import type { Metadata } from 'next';
import { Sora, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'EduVideo — AI-Powered Educational Video Platform',
  description: 'Create professional educational videos with AI narration, avatar presenters, and smart slide synchronization.',
  keywords: 'educational video, AI video, avatar presenter, text to speech, e-learning',
  openGraph: {
    title: 'EduVideo Platform',
    description: 'Create professional educational videos with AI',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans antialiased bg-surface-0 text-white min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
