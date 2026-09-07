// Replaces the `server-only` package under Vitest (see vitest.config.mts) so server modules can be
// imported by tests. In Next.js the real package throws when a client bundle imports them.
export {}
