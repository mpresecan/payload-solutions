import path from 'path'
import { loadEnv } from 'payload/node'
import { fileURLToPath } from 'url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default defineConfig(() => {
  loadEnv(path.resolve(dirname, './dev'))
  process.env.NODE_ENV = 'test'

  return {
    plugins: [
      tsconfigPaths({
        ignoreConfigErrors: true,
        projects: [path.resolve(dirname, 'dev/tsconfig.json')],
      }),
    ],
    test: {
      environment: 'node',
      fileParallelism: false,
      hookTimeout: 60_000,
      include: ['dev/**/*.spec.ts', '!dev/e2e.spec.ts'],
      testTimeout: 60_000,
    },
  }
})
