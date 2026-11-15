import type {NextConfig} from 'next';

const basePath = process.env.BASE_PATH?.trim() || '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  // On Vercel, Next's trailingSlash redirect runs before vercel.json routes, so
  // /__/auth/handler became /__/auth/handler/ and Firebase answered "Site Not Found".
  // vercel.json does the same redirect for every path except /__/.
  skipTrailingSlashRedirect: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
    unoptimized: true, // Required for static export
  },
  output: 'export',
  transpilePackages: ['motion'],
};

export default nextConfig;
