'use client'

import { ConsentGate, useConsent } from '@payload-solutions/consent-react'
import { useEffect, useState } from 'react'

/** Shows the live store state and a gated embed, so the effect of each decision is visible. */
export function ConsentDemo() {
  const { ready, state, has, withdraw, open } = useConsent()
  // An undecided visitor gets a fresh random consent id, which differs between the server render
  // and the client one. Show it only after mount so this demo does not trip React's hydration check.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!ready || !state) {
    return <p>Consent is disabled in the admin.</p>
  }
  return (
    <>
      <h2>Live state</h2>
      <pre className="state" data-consent-state="">
        {JSON.stringify(
          {
            status: state.status,
            model: state.model,
            ui: state.ui,
            decisions: state.decisions,
            repromptReason: state.repromptReason,
            gpc: state.gpc,
            needsReload: state.needsReload,
            consentId: mounted ? state.consentId : '…',
          },
          null,
          2,
        )}
      </pre>
      <p>
        <button onClick={() => open('preferences')} type="button">
          Open preferences
        </button>{' '}
        <button onClick={withdraw} type="button">
          Withdraw all
        </button>
      </p>

      <h2>Gated embed (functional)</h2>
      <ConsentGate
        category="functional"
        fallback={
          <div className="gate" data-consent-gate="blocked">
            This video needs the <strong>functional</strong> category.{' '}
            <button className="link" onClick={() => open('preferences')} type="button">
              Change cookie settings
            </button>
          </div>
        }
      >
        <div className="gate" data-consent-gate="granted">
          ▶ YouTube iframe would render here (functional granted: {String(has('functional'))})
        </div>
      </ConsentGate>

      <h2>Scripts</h2>
      <p>
        Analytics granted: <strong data-consent-analytics="">{String(has('analytics'))}</strong>. Trackers with a loader are injected
        as <code>&lt;script data-consent-tracker&gt;</code> once their category is granted; open the DOM inspector to see them.
      </p>
    </>
  )
}
