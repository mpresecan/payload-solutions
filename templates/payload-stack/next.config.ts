// observability-adapter-import
import { withSentryConfig } from '@sentry/nextjs'
import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
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

const config = withPayload(nextConfig, { devBundleServerPackages: false })

/**
 * Source maps and client instrumentation are a build-time concern, so this is the one part of
 * observability that cannot be swapped at runtime: without the project coordinates the wrapper is
 * skipped entirely and the build is untouched. Reporting itself only needs SENTRY_DSN.
 * The CLI rewrites what sits between the markers when you pick a different provider.
 */
// observability-adapter-config-start
const withObservability = (nextConfig: NextConfig): NextConfig =>
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? withSentryConfig(nextConfig, {
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        silent: !process.env.CI,
        widenClientFileUpload: true,
        // Serves the browser SDK's requests from your own origin, so ad blockers stop eating them.
        tunnelRoute: '/monitoring',
        disableLogger: true,
      })
    : nextConfig
// observability-adapter-config-end

export default withObservability(config)
