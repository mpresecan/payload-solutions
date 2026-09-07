import { defineConfig } from 'tsup'

const shared = {
  format: ['esm' as const],
  dts: true,
  sourcemap: true,
  target: 'es2022' as const,
  external: ['react', 'react-dom', 'react/jsx-runtime', '@payload-solutions/consent-core'],
}

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    clean: true,
    esbuildOptions(options) {
      options.jsx = 'automatic'
      options.banner = { js: '"use client";' }
    },
  },
  {
    ...shared,
    entry: { next: 'src/next.ts' },
    clean: false,
  },
])
