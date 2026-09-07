import { ConsentDemo } from './components/consent-demo.js'

export default function HomePage() {
  return (
    <>
      <h1>Payload Consent — dev app</h1>
      <p>
        Categories, trackers and legal pages are seeded on first boot and editable in the <a href="/admin">admin</a> under{' '}
        <em>Privacy</em>. Append <code>?consent_jurisdiction=US</code> to the config request or send an{' '}
        <code>x-vercel-ip-country</code> header to try other jurisdictions; without a header the fallback (opt-in) applies.
      </p>
      <ConsentDemo />
    </>
  )
}
