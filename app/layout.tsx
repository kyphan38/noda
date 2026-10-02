import type {Metadata, Viewport} from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'noda',
  description: 'noda - audio dictation and listening app.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: 'noda', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  // Khoa zoom: double-tap zoom tren dien thoai chi gay loi cham.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#030712',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{window.addEventListener("unhandledrejection",function(e){var r=e.reason;if(r&&typeof r==="object"&&r.name==="AbortError")e.preventDefault();},{capture:true});}catch(_){}})();`,
          }}
        />
      </head>
      <body
        className="min-h-screen font-sans overscroll-none antialiased"
        style={{backgroundColor: 'var(--background)', color: 'var(--foreground)'}}
        suppressHydrationWarning
      >
        <ServiceWorkerRegistrar />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
