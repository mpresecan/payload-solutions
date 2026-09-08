import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { NPX_COMMAND, brands } from '@payload-solutions/brand'

export const alt = `${brands.stack.name}: ${brands.stack.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'


export default async function OpenGraphImage() {
  // Geist is SIL OFL licensed; the three faces used here are vendored next to this file.
  const [sansMedium, sansRegular, mono] = await Promise.all([
    readFile(new URL('./og-fonts/Geist-Medium.ttf', import.meta.url)),
    readFile(new URL('./og-fonts/Geist-Regular.ttf', import.meta.url)),
    readFile(new URL('./og-fonts/GeistMono-Regular.ttf', import.meta.url)),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#0a0a0a',
          color: '#f2f2f2',
          fontFamily: 'Geist',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30 }}>
          <svg width="24" height="31" viewBox="0 0 20 26" fill="none">
            <path d="M10.5 3.49976L0.713097 8.15257V20.4896L8.2737 25.1999V12.8629L18 7.99976L10.5 3.49976Z" fill="#f2f2f2" />
            <path d="M11 23.5V15L18 19.5L11 23.5Z" fill="#f2f2f2" />
          </svg>
          <span style={{ fontWeight: 400, letterSpacing: '-0.03em' }}>Payload</span>
          <span style={{ fontWeight: 500, letterSpacing: '-0.03em', marginLeft: -6 }}>Stack</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 76, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1.02, maxWidth: 900 }}>
            Turn Payload CMS into a SaaS.
          </div>
          <div style={{ fontSize: 28, color: 'rgba(242,242,242,0.64)', maxWidth: 900, lineHeight: 1.35 }}>
            An open-source SaaS boilerplate: Better Auth, organizations, Stripe subscriptions and
            a shadcn dashboard, wired into Payload and Next.js.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            alignSelf: 'flex-start',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '18px 26px',
            fontFamily: 'Geist Mono',
            fontSize: 26,
          }}
        >
          <span style={{ color: 'rgba(242,242,242,0.42)' }}>$</span>
          <span>{NPX_COMMAND}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Geist', data: sansRegular, weight: 400, style: 'normal' },
        { name: 'Geist', data: sansMedium, weight: 500, style: 'normal' },
        { name: 'Geist Mono', data: mono, weight: 400, style: 'normal' },
      ],
    },
  )
}
