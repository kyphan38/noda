import type {NextConfig} from 'next';

const basePath = process.env.BASE_PATH?.trim() || '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
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
  webpack: (config, {dev}) => {
    // Optional: set DISABLE_HMR=true to reduce file watching / HMR flicker in some dev setups.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
