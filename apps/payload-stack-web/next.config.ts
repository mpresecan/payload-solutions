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
      {
        source: '/docs',
        destination: 'https://payload.solutions/docs/payload-stack',
        permanent: false,
      },
      {
        source: '/docs/:path*',
        destination: 'https://payload.solutions/docs/payload-stack/:path*',
        permanent: false,
      },
      {
        source: '/github',
        destination: 'https://github.com/mpresecan/payload-solutions',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
