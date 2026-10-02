import type { MetadataRoute } from 'next';

// basePath khi deploy (next.config.ts doc tu env BASE_PATH). De trong thi
// chay o goc domain nhu hien tai.
const basePath = process.env.BASE_PATH?.trim() || '';

// Static export bat buoc route phai la force-static.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'noda',
    short_name: 'noda',
    description: 'noda - audio dictation and listening app.',
    // Mo thang vao man hinh chinh. Do la ly do app ton tai.
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#030712',
    theme_color: '#030712',
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
