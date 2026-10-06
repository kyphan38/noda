import type { MetadataRoute } from 'next';

// Deploy basePath (next.config.ts reads BASE_PATH). Empty = served at the domain root.
const basePath = process.env.BASE_PATH?.trim() || '';

// Static export requires force-static routes.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'noda',
    short_name: 'noda',
    description: 'noda - audio dictation and listening app.',
    // Open straight into the main screen. That is why the app exists.
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [
      { src: `${basePath}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${basePath}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      {
        src: `${basePath}/icons/maskable-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
