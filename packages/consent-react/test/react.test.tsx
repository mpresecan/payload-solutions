import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { createTestConfig, encodeConsentCookie, memoryStorage, type ConsentTracker } from '@payload-solutions/consent-core'

import { ConsentGate, ConsentModeScript, ConsentProvider, ManageConsentButton, useCategory, useConsent } from '../src/index.js'
import { readConsent } from '../src/next.js'

const trackers: ConsentTracker[] = [
  { id: 'ph', name: 'PostHog', categoryKey: 'analytics', kind: 'script', loader: { src: 'https://example.test/ph.js', strategy: 'afterDecision', consentModeManaged: false } },
]

function Banner() {
  const { state, acceptAll, rejectAll, open, save, config } = useConsent()
  const analytics = useCategory('analytics')
  if (!state) return null
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="ui">{state.ui}</span>
      <span data-testid="analytics">{String(analytics.granted)}</span>
      <button onClick={acceptAll}>{config?.banner.labels.acceptAll}</button>
      <button onClick={rejectAll}>{config?.banner.labels.rejectAll}</button>
      <button onClick={() => open('preferences')}>customize</button>
      <button onClick={() => analytics.toggle(true)}>toggle analytics</button>
      <button onClick={save}>save</button>
    </div>
  )
}

afterEach(() => {
  cleanup()
  document.head.innerHTML = ''
})

describe('ConsentProvider', () => {
  it('exposes state, gates content and loads scripts after acceptance', async () => {
    const storage = memoryStorage()
    render(
      <ConsentProvider config={createTestConfig({ trackers })} storeOptions={{ storage, gpc: false }}>
        <Banner />
        <ConsentGate category="analytics" fallback={<p>blocked</p>}>
          <p>chart</p>
        </ConsentGate>
        <ManageConsentButton className="footer-link" />
      </ConsentProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('undecided')
    expect(screen.getByTestId('ui').textContent).toBe('banner')
    expect(screen.getByText('blocked')).toBeTruthy()
    expect(document.querySelector('script[data-consent-tracker="ph"]')).toBeNull()

    await act(async () => {
      screen.getByText('Accept all').click()
    })
    expect(screen.getByTestId('status').textContent).toBe('decided')
    expect(screen.getByTestId('analytics').textContent).toBe('true')
    expect(screen.getByText('chart')).toBeTruthy()
    expect(document.querySelector('script[data-consent-tracker="ph"]')).toBeTruthy()
    expect(storage.value).toBeTruthy()

    await act(async () => {
      screen.getByText('Cookie settings').click()
    })
    expect(screen.getByTestId('ui').textContent).toBe('preferences')
  })

  it('hydrates from the server-read cookie without showing the banner', () => {
    const config = createTestConfig()
    const cookie = encodeConsentCookie({ v: 1, id: 'a1b2c3d4-0000-4000-8000-000000000000', d: { functional: 0, analytics: 1, marketing: 0 }, t: Math.floor(Date.now() / 1000), pv: 'p1', cv: 'c1', tv: 't1', dv: 'd1', j: 'in', s: 'b' })
    render(
      <ConsentProvider config={config} initialCookie={cookie} storeOptions={{ storage: memoryStorage(cookie), gpc: false }}>
        <Banner />
      </ConsentProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('decided')
    expect(screen.getByTestId('ui').textContent).toBe('closed')
    expect(screen.getByTestId('analytics').textContent).toBe('true')
    expect(readConsent(`pl-consent=${encodeURIComponent(cookie)}`, config).has('analytics')).toBe(true)
  })

  it('renders children untouched when consent is disabled', () => {
    render(
      <ConsentProvider config={createTestConfig({ enabled: false })}>
        <ConsentGate category="marketing" fallback={<p>blocked</p>}>
          <p>embed</p>
        </ConsentGate>
      </ConsentProvider>,
    )
    expect(screen.getByText('embed')).toBeTruthy()
  })

  it('emits a Consent Mode default script derived from the initial state', () => {
    const config = createTestConfig({ consentMode: { enabled: true, adsDataRedaction: true, urlPassthrough: false, waitForUpdateMs: 500 } })
    const { container } = render(<ConsentModeScript config={config} cookie={null} />)
    const script = container.querySelector('script[data-consent-mode]')!
    expect(script.innerHTML).toContain("gtag('consent','default'")
    expect(script.innerHTML).toContain('__plConsentModeDefault')
    expect(script.innerHTML).toContain('"analytics_storage":"denied"')
    expect(script.innerHTML).toContain('"security_storage":"granted"')
    expect(script.innerHTML).toContain('ads_data_redaction')
  })
})
