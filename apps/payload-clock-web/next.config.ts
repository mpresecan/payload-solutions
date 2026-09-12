import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@payload-solutions/brand'],
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      // All documentation lives on payload.solutions; the domain only ever forwards.
      {
        source: '/docs',
        destination: 'https://payload.solutions/docs/payload-clock',
        permanent: false,
      },
      {
        source: '/docs/:path*',
        destination: 'https://payload.solutions/docs/payload-clock/:path*',
        permanent: false,
      },
      {
        source: '/github',
        destination: 'https://github.com/mpresecan/payload-solutions',
        permanent: false,
      },
      // The old site sold the Action Scheduler under the Clock name and linked to its own
      // repository. Those links are still in the wild; send them to the plugin's real home.
      {
        source: '/action-scheduler',
        destination: 'https://payload.solutions/docs/plugins/payload-action-scheduler',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
