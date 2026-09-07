import type { TrackerPresetKey } from '../types.js'

export type TrackerPreset = {
  key: TrackerPresetKey
  name: string
  vendor: string
  vendorPrivacyUrl: string
  categoryKey: string
  kind: 'script' | 'pixel' | 'iframe' | 'sdk' | 'cookie-only'
  purpose: string
  cookies: Array<{ name: string; domain?: string; storage?: 'cookie' | 'localStorage' | 'sessionStorage' | 'indexedDB'; durationText?: string; description?: string }>
  /** Placeholders in `{{var}}` form are substituted from `vars` at seed time. */
  loader?: { src?: string; inlineCode?: string; consentModeManaged?: boolean; strategy?: 'afterDecision' | 'lazy'; attributes?: Record<string, string> }
  /** Variables the preset expects (documentation + validation). */
  vars?: string[]
}

export const TRACKER_PRESETS: Record<TrackerPresetKey, TrackerPreset> = {
  posthog: {
    key: 'posthog',
    name: 'PostHog',
    vendor: 'PostHog Inc.',
    vendorPrivacyUrl: 'https://posthog.com/privacy',
    categoryKey: 'analytics',
    kind: 'sdk',
    purpose: 'Product analytics: which features are used and where people get stuck. Initialised by the application code; the plugin gates capture through the analytics category.',
    cookies: [
      { name: 'ph_{{projectKey}}_posthog', durationText: '12 months', description: 'Distinct id and session information.' },
      { name: 'ph_phc_*_posthog', storage: 'localStorage', durationText: 'Until cleared', description: 'Feature flags and persistence.' },
    ],
    vars: ['projectKey'],
  },
  'posthog-eu': {
    key: 'posthog-eu',
    name: 'PostHog (EU Cloud)',
    vendor: 'PostHog Inc.',
    vendorPrivacyUrl: 'https://posthog.com/privacy',
    categoryKey: 'analytics',
    kind: 'sdk',
    purpose: 'Product analytics hosted in the EU. Initialised by the application code; capture only starts once the analytics category is granted.',
    cookies: [{ name: 'ph_{{projectKey}}_posthog', durationText: '12 months', description: 'Distinct id and session information.' }],
    vars: ['projectKey'],
  },
  ga4: {
    key: 'ga4',
    name: 'Google Analytics 4',
    vendor: 'Google LLC',
    vendorPrivacyUrl: 'https://policies.google.com/privacy',
    categoryKey: 'analytics',
    kind: 'script',
    purpose: 'Web analytics: page views, sessions and conversions. Loaded immediately and governed by Google Consent Mode v2.',
    cookies: [
      { name: '_ga', durationText: '2 years', description: 'Distinguishes users.' },
      { name: '_ga_{{measurementId}}', durationText: '2 years', description: 'Persists session state.' },
    ],
    loader: {
      src: 'https://www.googletagmanager.com/gtag/js?id={{measurementId}}',
      inlineCode: undefined,
      consentModeManaged: true,
    },
    vars: ['measurementId'],
  },
  gtm: {
    key: 'gtm',
    name: 'Google Tag Manager',
    vendor: 'Google LLC',
    vendorPrivacyUrl: 'https://policies.google.com/privacy',
    categoryKey: 'marketing',
    kind: 'script',
    purpose: 'Tag container. Loaded immediately; the tags inside are governed by Google Consent Mode v2 signals.',
    cookies: [],
    loader: { src: 'https://www.googletagmanager.com/gtm.js?id={{containerId}}', consentModeManaged: true },
    vars: ['containerId'],
  },
  'meta-pixel': {
    key: 'meta-pixel',
    name: 'Meta Pixel',
    vendor: 'Meta Platforms, Inc.',
    vendorPrivacyUrl: 'https://www.facebook.com/privacy/policy/',
    categoryKey: 'marketing',
    kind: 'script',
    purpose: 'Measures advertising conversions and builds audiences on Meta platforms.',
    cookies: [
      { name: '_fbp', durationText: '3 months', description: 'Browser id for ad delivery and measurement.' },
      { name: '_fbc', durationText: '3 months', description: 'Click id from Meta ads.' },
    ],
    loader: {
      inlineCode:
        "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','{{pixelId}}');fbq('track','PageView');",
    },
    vars: ['pixelId'],
  },
  'linkedin-insight': {
    key: 'linkedin-insight',
    name: 'LinkedIn Insight Tag',
    vendor: 'LinkedIn Corporation',
    vendorPrivacyUrl: 'https://www.linkedin.com/legal/privacy-policy',
    categoryKey: 'marketing',
    kind: 'script',
    purpose: 'Conversion tracking and retargeting for LinkedIn campaigns.',
    cookies: [
      { name: 'li_sugr', domain: '.linkedin.com', durationText: '3 months' },
      { name: 'bcookie', domain: '.linkedin.com', durationText: '1 year' },
    ],
    loader: {
      inlineCode:
        "window._linkedin_partner_id='{{partnerId}}';window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push('{{partnerId}}');(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName('script')[0];var b=document.createElement('script');b.type='text/javascript';b.async=true;b.src='https://snap.licdn.com/li.lms-analytics/insight.min.js';s.parentNode.insertBefore(b,s)})(window.lintrk);",
    },
    vars: ['partnerId'],
  },
  hotjar: {
    key: 'hotjar',
    name: 'Hotjar',
    vendor: 'Hotjar Ltd.',
    vendorPrivacyUrl: 'https://www.hotjar.com/legal/policies/privacy/',
    categoryKey: 'analytics',
    kind: 'script',
    purpose: 'Heatmaps and session recordings to understand how pages are used.',
    cookies: [
      { name: '_hjSessionUser_{{siteId}}', durationText: '1 year' },
      { name: '_hjSession_{{siteId}}', durationText: '30 minutes' },
    ],
    loader: {
      inlineCode:
        "(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:{{siteId}},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r)})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');",
    },
    vars: ['siteId'],
  },
  clarity: {
    key: 'clarity',
    name: 'Microsoft Clarity',
    vendor: 'Microsoft Corporation',
    vendorPrivacyUrl: 'https://privacy.microsoft.com/privacystatement',
    categoryKey: 'analytics',
    kind: 'script',
    purpose: 'Session replay and heatmaps.',
    cookies: [
      { name: '_clck', durationText: '1 year' },
      { name: '_clsk', durationText: '1 day' },
    ],
    loader: {
      inlineCode:
        "(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,'clarity','script','{{projectId}}');",
    },
    vars: ['projectId'],
  },
  intercom: {
    key: 'intercom',
    name: 'Intercom',
    vendor: 'Intercom, Inc.',
    vendorPrivacyUrl: 'https://www.intercom.com/legal/privacy',
    categoryKey: 'functional',
    kind: 'sdk',
    purpose: 'Customer messaging widget. Initialised by the application once the functional category is granted.',
    cookies: [{ name: 'intercom-id-{{appId}}', durationText: '9 months' }, { name: 'intercom-session-{{appId}}', durationText: '1 week' }],
    vars: ['appId'],
  },
  crisp: {
    key: 'crisp',
    name: 'Crisp',
    vendor: 'Crisp IM SAS',
    vendorPrivacyUrl: 'https://crisp.chat/en/privacy/',
    categoryKey: 'functional',
    kind: 'script',
    purpose: 'Live chat widget.',
    cookies: [{ name: 'crisp-client/session/*', durationText: '6 months' }],
    loader: { inlineCode: "window.$crisp=[];window.CRISP_WEBSITE_ID='{{websiteId}}';(function(){d=document;s=d.createElement('script');s.src='https://client.crisp.chat/l.js';s.async=1;d.getElementsByTagName('head')[0].appendChild(s);})();" },
    vars: ['websiteId'],
  },
  youtube: {
    key: 'youtube',
    name: 'YouTube embeds',
    vendor: 'Google LLC',
    vendorPrivacyUrl: 'https://policies.google.com/privacy',
    categoryKey: 'functional',
    kind: 'iframe',
    purpose: 'Embedded videos. Placeholders are shown until the functional category is granted (use ConsentGate).',
    cookies: [{ name: 'VISITOR_INFO1_LIVE', domain: '.youtube.com', durationText: '6 months' }, { name: 'YSC', domain: '.youtube.com', durationText: 'Session' }],
  },
  vimeo: {
    key: 'vimeo',
    name: 'Vimeo embeds',
    vendor: 'Vimeo.com, Inc.',
    vendorPrivacyUrl: 'https://vimeo.com/privacy',
    categoryKey: 'functional',
    kind: 'iframe',
    purpose: 'Embedded videos, gated with ConsentGate.',
    cookies: [{ name: 'vuid', domain: '.vimeo.com', durationText: '2 years' }],
  },
  'google-maps': {
    key: 'google-maps',
    name: 'Google Maps embeds',
    vendor: 'Google LLC',
    vendorPrivacyUrl: 'https://policies.google.com/privacy',
    categoryKey: 'functional',
    kind: 'iframe',
    purpose: 'Embedded maps, gated with ConsentGate.',
    cookies: [{ name: 'NID', domain: '.google.com', durationText: '6 months' }],
  },
  stripe: {
    key: 'stripe',
    name: 'Stripe',
    vendor: 'Stripe, Inc.',
    vendorPrivacyUrl: 'https://stripe.com/privacy',
    categoryKey: 'necessary',
    kind: 'cookie-only',
    purpose: 'Payment processing and fraud prevention during checkout.',
    cookies: [{ name: '__stripe_mid', durationText: '1 year', description: 'Fraud prevention.' }, { name: '__stripe_sid', durationText: '30 minutes' }],
  },
  'vercel-analytics': {
    key: 'vercel-analytics',
    name: 'Vercel Web Analytics',
    vendor: 'Vercel Inc.',
    vendorPrivacyUrl: 'https://vercel.com/legal/privacy-policy',
    categoryKey: 'analytics',
    kind: 'sdk',
    purpose: 'Cookieless page view counting. Declared for transparency; sets no cookies.',
    cookies: [],
  },
  umami: {
    key: 'umami',
    name: 'Umami',
    vendor: 'Self-hosted / Umami Software',
    vendorPrivacyUrl: 'https://umami.is/privacy',
    categoryKey: 'analytics',
    kind: 'script',
    purpose: 'Cookieless, privacy-friendly analytics.',
    cookies: [],
    loader: { src: '{{scriptUrl}}', attributes: { 'data-website-id': '{{websiteId}}', defer: '' } },
    vars: ['scriptUrl', 'websiteId'],
  },
  plausible: {
    key: 'plausible',
    name: 'Plausible',
    vendor: 'Plausible Insights OÜ',
    vendorPrivacyUrl: 'https://plausible.io/privacy',
    categoryKey: 'analytics',
    kind: 'script',
    purpose: 'Cookieless, privacy-friendly analytics.',
    cookies: [],
    loader: { src: 'https://plausible.io/js/script.js', attributes: { 'data-domain': '{{domain}}', defer: '' } },
    vars: ['domain'],
  },
}

export function substituteVars<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (m, key: string) => vars[key] ?? m) as unknown as T
  }
  if (Array.isArray(value)) return value.map((v) => substituteVars(v, vars)) as unknown as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substituteVars(v, vars)])) as unknown as T
  }
  return value
}
