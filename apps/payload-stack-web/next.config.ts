import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@payload-solutions/brand'],
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Baseline hardening for a static marketing site. No CSP yet: PostHog, the clip CDN and the
  // inline theme script would each need allowing, so it gets its own change.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
    ]
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
