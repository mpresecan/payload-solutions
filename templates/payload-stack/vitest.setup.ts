/**
 * Setup for the `int` Vitest project (see vitest.config.mts). The environment rules, including how
 * CI overrides them, live in tests/helpers/test-env.ts.
 */
import { loadTestEnv } from './tests/helpers/test-env'

loadTestEnv('int')
