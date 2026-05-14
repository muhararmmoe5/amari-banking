/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'xlsx'],
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
