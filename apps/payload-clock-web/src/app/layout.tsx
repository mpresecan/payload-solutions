import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { brands } from '@payload-solutions/brand'
import './globals.css'

const brand = brands.clock

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: {
    default: `${brand.name}: ${brand.tagline}`,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  keywords: [
    'Payload CMS',
    'Payload job queue',
    'serverless cron',
    'cron for Payload',
    'scheduled jobs',
    'Vercel cron alternative',
    'payload-jobs run',
    'task scheduler',
  ],
  openGraph: {
    type: 'website',
    siteName: brand.name,
    title: brand.tagline,
    description: brand.description,
    url: brand.url,
  },
  twitter: {
    card: 'summary_large_image',
    title: brand.tagline,
    description: brand.description,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
}

export const viewport: Viewport = {
  // The site opens dark whatever the system says, so the browser chrome matches.
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}

/**
 * Applies the theme before first paint. Dark is the default whatever the system prefers;
 * the toggle in the footer writes `ps-theme` = light | dark. The key is shared with the
 * sibling sites deliberately — a visitor who picks light on payloadstack.com gets light here.
 */
const themeInitScript = `(function(){var t='dark';try{var s=localStorage.getItem('ps-theme');if(s==='light'||s==='dark'){t=s}}catch(e){}document.documentElement.setAttribute('data-theme',t)})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* data-brand picks this site's accent family (brass) out of the shared token set. */
    <html
      lang="en"
      data-brand="clock"
      /* Next disables CSS smooth scrolling during route changes unless this is set. */
      data-scroll-behavior="smooth"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">{children}</body>
    </html>
  )
}
