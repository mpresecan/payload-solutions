/**
 * Payload Stack Pro: the verticals it will scaffold. One list, read by the waitlist collection,
 * the signup action and the /pro page, so adding a vertical is a one-line change (plus the
 * migration that adds its value to the enum).
 */
export const PRO_VERTICALS = [
  {
    value: 'ai-chat',
    label: 'AI chat app',
    summary:
      'A ChatGPT-style product for your niche: threads, streaming replies, model choice, usage metered per organization and billed through the plans you already have.',
  },
  {
    value: 'marketplace',
    label: 'Digital goods marketplace',
    summary:
      'Sell downloads, templates or licences: storefront, product pages, checkout, secure delivery and seller payouts on Stripe.',
  },
  {
    value: 'courses',
    label: 'Online courses',
    summary:
      'Courses, lessons and video, progress per learner, drip release and access tied to a purchase or a subscription.',
  },
  {
    value: 'feedback',
    label: 'Feedback, roadmap and changelog',
    summary:
      'A public board where your users post and vote on requests, a roadmap by status and a changelog that tells voters when their idea shipped.',
  },
] as const

export type ProVertical = (typeof PRO_VERTICALS)[number]['value']

export const PRO_STAGES = [
  { value: 'idea', label: 'Exploring an idea' },
  { value: 'building', label: 'Building now' },
  { value: 'live', label: 'Running a product' },
  { value: 'agency', label: 'Agency, building for clients' },
] as const
