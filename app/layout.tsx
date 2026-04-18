import type {Metadata} from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'noda',
  description: 'noda dictation and shadowing app.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/branding/noda-icon.svg',
  },
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
        className="min-h-screen font-sans antialiased"
        style={{backgroundColor: 'var(--background)', color: 'var(--foreground)'}}
        suppressHydrationWarning
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
