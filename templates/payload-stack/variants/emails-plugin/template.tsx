import { Body, Container, Head, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { EmailTemplate, TemplateStyles } from '@payload-solutions/plugin-emails'
import React from 'react'

/**
 * The template every transactional email is rendered inside.
 *
 * Branding lives here, in code, so it is designed once and no editor can drift it. Editors own the
 * words: the subject, preheader and body of each email (Payload admin → Emails) and the footer
 * (Email Settings). Those arrive as `children` and `footer`, already converted to React Email
 * elements with `{{variables}}` filled in.
 *
 * To rebrand: change `palette`, `FONT` and the wordmark below. To restructure: this is an ordinary
 * React Email component — https://react.email/components.
 */

/**
 * One palette per colour scheme. `light` drives the inline styles every client understands; `dark`
 * drives the `@media (prefers-color-scheme: dark)` block, which Apple Mail, iOS Mail, Outlook for
 * Mac and Thunderbird honour. Clients that ignore it (Gmail web, most Windows clients) keep the
 * light design, which is why the light palette must stand on its own.
 */
export const palette = {
  light: {
    page: '#f4f4f5',
    card: '#ffffff',
    border: '#e4e4e7',
    accent: '#18181b',
    heading: '#18181b',
    text: '#3f3f46',
    muted: '#71717a',
    link: '#18181b',
    buttonBg: '#18181b',
    buttonText: '#fafafa',
    codeBg: '#f4f4f5',
    codeText: '#27272a',
  },
  dark: {
    page: '#09090b',
    card: '#131316',
    border: '#27272a',
    accent: '#fafafa',
    heading: '#fafafa',
    text: '#d4d4d8',
    muted: '#a1a1aa',
    link: '#fafafa',
    buttonBg: '#fafafa',
    buttonText: '#18181b',
    codeBg: '#27272a',
    codeText: '#e4e4e7',
  },
} as const

const FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"'

const light = palette.light

/**
 * Class hooks. Inline styles are the only thing every email client honours, and `@media` cannot
 * reach an inline style — so every element that changes in dark mode also carries a class for the
 * stylesheet below to override. `pe-*` are the classes the plugin puts on editor-owned copy;
 * `ps-*` are this template's own.
 */
const CLASS = {
  body: 'ps-body',
  card: 'ps-card',
  brand: 'ps-brand',
  accent: 'ps-accent',
  footer: 'ps-footer',
} as const

/**
 * Dark mode. Two selectors for every rule the body copy needs: the plugin's `pe-*` class, and a
 * descendant selector under the card, so the copy stays readable even if a future version of the
 * converter stops emitting class names. `!important` is not optional — these override inline styles.
 */
const darkCSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .${CLASS.body} { background-color: ${palette.dark.page} !important; }
    /* React Email's <Body> repeats its style on an inner wrapper cell, and only <body> can carry a
       class, so repaint that one cell by structure. The chain stops before the card, which sits
       deeper inside the Container table. */
    .${CLASS.body} > table > tbody > tr > td { background-color: ${palette.dark.page} !important; }
    .${CLASS.card} {
      background-color: ${palette.dark.card} !important;
      border-color: ${palette.dark.border} !important;
    }
    .${CLASS.accent} { background-color: ${palette.dark.accent} !important; }
    .${CLASS.brand} { color: ${palette.dark.heading} !important; }
    .${CLASS.footer}, .${CLASS.footer} p, .${CLASS.footer} li { color: ${palette.dark.muted} !important; }

    .pe-text, .pe-list, .pe-list-item,
    .${CLASS.card} p, .${CLASS.card} li, .${CLASS.card} td { color: ${palette.dark.text} !important; }
    .pe-heading,
    .${CLASS.card} h1, .${CLASS.card} h2, .${CLASS.card} h3 { color: ${palette.dark.heading} !important; }
    /* Two classes deep, so the small print keeps its muted colour instead of taking the body rule above. */
    .${CLASS.card} .pe-fine { color: ${palette.dark.muted} !important; }
    .pe-quote,
    .${CLASS.card} blockquote {
      border-color: ${palette.dark.border} !important;
      color: ${palette.dark.muted} !important;
    }
    .pe-hr,
    .${CLASS.card} hr { border-color: ${palette.dark.border} !important; }
    .pe-code,
    .${CLASS.card} code {
      background-color: ${palette.dark.codeBg} !important;
      color: ${palette.dark.codeText} !important;
    }
    /* Links before buttons: a button is also an <a>, and the attribute selector re-inverts it.
       Both are needed because the button's colours are inline and unreachable by class alone in
       clients that drop the plugin's class names. */
    .pe-link,
    .${CLASS.card} a { color: ${palette.dark.link} !important; }
    .pe-button,
    .${CLASS.card} a[style*="background-color"] {
      background-color: ${palette.dark.buttonBg} !important;
      color: ${palette.dark.buttonText} !important;
    }
  }
`

const bodyStyle: React.CSSProperties = {
  backgroundColor: light.page,
  fontFamily: FONT,
  margin: 0,
  padding: '40px 12px',
}

const containerStyle: React.CSSProperties = { margin: '0 auto', maxWidth: '600px', width: '100%' }

const brandStyle: React.CSSProperties = {
  color: light.heading,
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  margin: '0 0 14px',
  textTransform: 'uppercase',
}

/** A 3px rule along the top of the card: the one piece of colour, and the cheapest way to rebrand. */
const accentStyle: React.CSSProperties = {
  backgroundColor: light.accent,
  fontSize: '1px',
  height: '3px',
  lineHeight: '3px',
}

const cardStyle: React.CSSProperties = {
  backgroundColor: light.card,
  border: `1px solid ${light.border}`,
  borderTop: 'none',
  padding: '36px 40px 26px',
}

const footerStyle: React.CSSProperties = {
  color: light.muted,
  fontSize: '12px',
  lineHeight: '1.6',
  padding: '22px 40px 0',
  textAlign: 'center',
}

const footerTextStyle: React.CSSProperties = { color: light.muted, fontSize: '12px', lineHeight: '1.6', margin: 0 }
const footerLinkStyle: React.CSSProperties = { color: light.muted, textDecoration: 'underline' }

/** A value from the resolved variables, or nothing. */
const text = (variables: Record<string, unknown>, name: string): string | undefined => {
  const value = variables[name]
  return typeof value === 'string' && value.length > 0 ? value : typeof value === 'number' ? String(value) : undefined
}

/**
 * The footer when Email Settings has none — which is how every project starts.
 *
 * It is built from the global variables (src/emails/variables.ts), so it names the right company
 * and points at the right pages without anyone filling a form in first. Writing a footer in Email
 * Settings replaces this entirely.
 */
function DefaultFooter({ variables }: { variables: Record<string, unknown> }) {
  const company = text(variables, 'company.name') ?? text(variables, 'site.name')
  const year = text(variables, 'year')
  const links = [
    { href: text(variables, 'url.privacy'), label: 'Privacy' },
    { href: text(variables, 'url.terms'), label: 'Terms' },
    { href: text(variables, 'support.email') ? `mailto:${text(variables, 'support.email')}` : undefined, label: 'Contact' },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href))

  return (
    <>
      {company ? (
        <Text style={footerTextStyle}>
          {year ? `© ${year} ` : ''}
          {company}
        </Text>
      ) : null}
      {links.length ? (
        <Text style={footerTextStyle}>
          {links.map((link, i) => (
            <React.Fragment key={link.label}>
              {i > 0 ? ' · ' : ''}
              <Link href={link.href} style={footerLinkStyle}>
                {link.label}
              </Link>
            </React.Fragment>
          ))}
        </Text>
      ) : null}
    </>
  )
}

/**
 * How editor-owned copy is styled. The plugin's Lexical → React Email converter reads this, so a
 * paragraph typed in the admin looks like a paragraph written here.
 */
export const stackStyles: TemplateStyles = {
  blockquote: {
    borderLeft: `3px solid ${light.border}`,
    color: light.muted,
    margin: '0 0 18px',
    padding: '2px 0 2px 16px',
  },
  button: {
    backgroundColor: light.buttonBg,
    borderRadius: '6px',
    color: light.buttonText,
    fontSize: '15px',
    fontWeight: 600,
    padding: '13px 26px',
  },
  // Small print: the copyable link under every action button. Quiet enough that the button stays
  // the obvious thing to do, and `overflowWrap` keeps a long token URL inside the card.
  fine: { color: light.muted, fontSize: '13px', lineHeight: '1.5', margin: '0 0 16px', overflowWrap: 'break-word' },
  h1: { color: light.heading, fontSize: '24px', fontWeight: 700, lineHeight: '1.3', margin: '0 0 18px' },
  h2: { color: light.heading, fontSize: '19px', fontWeight: 700, lineHeight: '1.35', margin: '28px 0 12px' },
  h3: { color: light.heading, fontSize: '16px', fontWeight: 600, lineHeight: '1.4', margin: '24px 0 8px' },
  hr: { borderColor: light.border, margin: '28px 0' },
  link: { color: light.link, textDecoration: 'underline' },
  list: { margin: '0 0 18px', paddingLeft: '22px' },
  listItem: { color: light.text, margin: '0 0 8px', paddingLeft: '4px' },
  // `overflowWrap` keeps a long token URL — the fallback under every action button — inside the card.
  text: { color: light.text, fontSize: '15px', lineHeight: '1.65', margin: '0 0 18px', overflowWrap: 'break-word' },
}

export const StackEmailTemplate: EmailTemplate = ({ children, footer, locale, preheader, settings, variables }) => {
  // Email Settings wins over stack.config.ts, and the resolved variables already apply that order.
  const siteName = text(variables, 'site.name') ?? settings.siteName
  const siteUrl = text(variables, 'site.url') ?? settings.siteUrl

  return (
    <Html lang={locale ?? 'en'}>
      <Head>
        <meta content="light dark" name="color-scheme" />
        <meta content="light dark" name="supported-color-schemes" />
        <style dangerouslySetInnerHTML={{ __html: darkCSS }} />
      </Head>
      {preheader ? <Preview>{preheader}</Preview> : null}
      <Body className={CLASS.body} style={bodyStyle}>
        <Container style={containerStyle}>
          {siteName ? (
            <Text className={CLASS.brand} style={brandStyle}>
              {siteUrl ? (
                <Link href={siteUrl} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {siteName}
                </Link>
              ) : (
                siteName
              )}
            </Text>
          ) : null}
          <Section className={CLASS.accent} style={accentStyle}>
            <Text style={{ fontSize: '1px', lineHeight: '1px', margin: 0 }}>&nbsp;</Text>
          </Section>
          <Section className={CLASS.card} style={cardStyle}>
            {children}
          </Section>
          <Section className={CLASS.footer} style={footerStyle}>
            {footer ?? <DefaultFooter variables={variables} />}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

StackEmailTemplate.styles = stackStyles

export default StackEmailTemplate
