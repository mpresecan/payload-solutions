import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { brands } from '@payload-solutions/brand'
import './globals.css'

const brand = brands.stack

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
    'SaaS boilerplate',
    'Next.js SaaS starter',
    'Better Auth',
    'Stripe subscriptions',
    'multi-tenant',
    'shadcn/ui',
    'create-payload-stack',
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
}

/**
 * Applies a stored theme choice before first paint. System preference is the default;
 * the toggle in the header writes `ps-theme` = light | dark | system.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('ps-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* data-brand picks this site's accent family (violet) out of the shared token set. */
    <html
      lang="en"
      data-brand="stack"
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
