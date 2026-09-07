import { withPayload } from '@payloadcms/next/withPayload'
import { fileURLToPath } from 'url'
import path from 'path'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sibling workspace packages are consumed from TypeScript source in development.
  transpilePackages: ['@payload-solutions/consent-core', '@payload-solutions/consent-react'],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
