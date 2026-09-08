import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import React from 'react'

import type { EmailSettings, EmailTemplate, EmailTemplateProps, TemplateStyles } from '../types.js'

/**
 * Styles the body converter uses so editor copy matches the template it is rendered in.
 * A template that wants a different look exports its own and sets `styles` on the registration.
 */
export const defaultStyles: TemplateStyles = {
  blockquote: {
    borderLeft: '3px solid #d4d4d8',
    color: '#52525b',
    margin: '0 0 16px',
    padding: '0 0 0 16px',
  },
  button: {
    backgroundColor: '#18181b',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 600,
    padding: '12px 24px',
  },
  h1: { fontSize: '28px', fontWeight: 700, lineHeight: '1.25', margin: '0 0 16px' },
  h2: { fontSize: '22px', fontWeight: 700, lineHeight: '1.3', margin: '24px 0 12px' },
  h3: { fontSize: '18px', fontWeight: 600, lineHeight: '1.35', margin: '20px 0 8px' },
  hr: { borderColor: '#e4e4e7', margin: '24px 0' },
  link: { color: '#18181b', textDecoration: 'underline' },
  list: { margin: '0 0 16px', paddingLeft: '24px' },
  listItem: { margin: '0 0 6px', paddingLeft: '4px' },
  text: { color: '#27272a', fontSize: '16px', lineHeight: '1.6', margin: '0 0 16px' },
}

const FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"'

const body: React.CSSProperties = { backgroundColor: '#f4f4f5', fontFamily: FONT, margin: 0, padding: '32px 12px' }
const container: React.CSSProperties = { margin: '0 auto', maxWidth: '600px', width: '100%' }
const card: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '32px 40px',
}
const brand: React.CSSProperties = {
  color: '#18181b',
  fontSize: '16px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  margin: '0 0 16px',
}
const footerStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '1.5',
  padding: '20px 40px 0',
}

/**
 * Class names the body converter puts on every element it renders (see `lexical-react.tsx`), so a
 * template can restyle editor copy from a stylesheet — which is the only way to reach it from a
 * media query, since everything else is inline styles that `@media` cannot touch.
 */
export const EMAIL_CLASS = {
  body: 'pe-body',
  brand: 'pe-brand',
  button: 'pe-button',
  card: 'pe-card',
  code: 'pe-code',
  footer: 'pe-footer',
  heading: 'pe-heading',
  hr: 'pe-hr',
  link: 'pe-link',
  list: 'pe-list',
  listItem: 'pe-list-item',
  quote: 'pe-quote',
  text: 'pe-text',
} as const

/**
 * Dark-mode palette for the default template. Clients that honour `prefers-color-scheme` — Apple
 * Mail, iOS Mail, Outlook for Mac among them — swap to this when the device is in dark mode.
 * `!important` is required: it is overriding the inline styles above.
 */
export const darkModeCSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .${EMAIL_CLASS.body} { background-color: #09090b !important; }
    /* React Email's <Body> puts the styles on an inner wrapper cell as well as on <body>, and only
       <body> can carry a class — so repaint that one cell by structure. The chain stops before the
       card, which is nested deeper inside a Container table. */
    .${EMAIL_CLASS.body} > table > tbody > tr > td { background-color: #09090b !important; }
    .${EMAIL_CLASS.card} { background-color: #18181b !important; }
    .${EMAIL_CLASS.brand} { color: #fafafa !important; }
    .${EMAIL_CLASS.text},
    .${EMAIL_CLASS.heading},
    .${EMAIL_CLASS.list},
    .${EMAIL_CLASS.listItem} { color: #d4d4d8 !important; }
    .${EMAIL_CLASS.link} { color: #fafafa !important; }
    .${EMAIL_CLASS.button} { background-color: #fafafa !important; color: #18181b !important; }
    .${EMAIL_CLASS.quote} { border-color: #3f3f46 !important; color: #a1a1aa !important; }
    .${EMAIL_CLASS.hr} { border-color: #27272a !important; }
    .${EMAIL_CLASS.code} { background-color: #27272a !important; color: #e4e4e7 !important; }
    .${EMAIL_CLASS.footer} { color: #a1a1aa !important; }
  }
`

/**
 * The template every email is rendered inside. Branding lives here, in code — colours, spacing,
 * the wordmark, the shell — so it is designed once and no editor can drift it. Editors supply the
 * copy (`children`) and the footer.
 *
 * Register your own with `emailsPlugin({ templates: { default: MyTemplate } })`.
 */
export const DefaultTemplate: EmailTemplate = ({ children, footer, locale, preheader, settings }) => (
  <Html lang={locale ?? 'en'}>
    <Head>
      <meta content="light dark" name="color-scheme" />
      <meta content="light dark" name="supported-color-schemes" />
      <style dangerouslySetInnerHTML={{ __html: darkModeCSS }} />
    </Head>
    {preheader ? <Preview>{preheader}</Preview> : null}
    <Body className={EMAIL_CLASS.body} style={body}>
      <Container style={container}>
        {settings.siteName ? (
          <Text className={EMAIL_CLASS.brand} style={brand}>
            {settings.siteName}
          </Text>
        ) : null}
        <Section className={EMAIL_CLASS.card} style={card}>
          {children}
        </Section>
        {footer ? (
          <Section className={EMAIL_CLASS.footer} style={footerStyle}>
            {footer}
          </Section>
        ) : null}
      </Container>
    </Body>
  </Html>
)

/** Copy shown when a template is previewed on its own, with no particular email selected. */
export const templatePreviewCopy = {
  body: 'This is what every email looks like. The heading, spacing, colours and the shell around this text come from the template, which lives in your project’s code.\n\nOnly the words inside each email — and the footer below — are edited here in the admin.',
  heading: 'Template preview',
  subject: 'Template preview',
}

export type { EmailSettings, EmailTemplate, EmailTemplateProps }
