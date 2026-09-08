import type { Plugin } from 'payload'

/**
 * Payload Consent is not installed in this project.
 *
 * The cookie banner, the consent records, the processor register and the legal-page editor with
 * its generated cookie and sub-processor tables all live in `@payload-solutions/plugin-consent`.
 * Scaffold with `create-payload-stack --consent` to get them.
 *
 * This module is the seam either way: `payload.config.ts` spreads `consentPlugins` whichever
 * answer you gave, so nothing in the application had to be rewritten to add or remove consent.
 *
 * https://payload.solutions/docs/plugins/payload-consent
 */
export const consentPlugins: Plugin[] = []
