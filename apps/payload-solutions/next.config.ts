import { withPayload } from '@payloadcms/next/withPayload'
import { createMDX } from 'fumadocs-mdx/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@payload-solutions/brand'],
  poweredByHeader: false,
  images: {
    localPatterns: [{ pathname: '/api/media/file/**' }],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
}

const withMDX = createMDX({
  // Turbopack matches rule globs against the path relative to the workspace root (the monorepo),
  // so the pattern has to be root-agnostic.
  macro: { include: ['**/src/lib/source.ts'] },
})

export default withMDX(withPayload(nextConfig, { devBundleServerPackages: false }))
