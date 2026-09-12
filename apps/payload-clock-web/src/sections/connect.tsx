import { SOLUTIONS_URL } from '@payload-solutions/brand'
import { ActionRow, SectionHead } from '@payload-solutions/brand/lattice'
import { CodeBlock, c, k, p, str } from '@/components/code-block'
import { Reveal } from '@/components/reveal'

/*
  The setup, shown rather than described. Two blocks: the plugin route, which is what we
  recommend, and the plain one for a project that does not want another dependency. Both are
  short enough to read at a glance, which is the argument.
*/
export function Connect() {
  return (
    <section
      id="connect"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="connect-heading"
    >
      <div className="container-content col-grid gap-y-14">
        <Reveal className="lg:col-span-2 lg:pr-12">
          <SectionHead
            id="connect-heading"
            eyebrow="Connect"
            title="Two lines in your Payload config."
            lead="Payload’s run endpoint is closed to everyone but a logged-in user until you say otherwise, so connecting Clock means telling Payload to trust it. The plugin ships that access function, verifies your deployment in one click, and puts the next and last ten runs inside your admin."
          />
          <div className="mt-10 border-t border-border">
            <ActionRow href={`${SOLUTIONS_URL}/docs/payload-clock`}>
              Read the documentation
            </ActionRow>
            <ActionRow
              href={`${SOLUTIONS_URL}/docs/plugins/payload-action-scheduler`}
              meta="companion"
            >
              Payload Action Scheduler
            </ActionRow>
          </div>
        </Reveal>

        <Reveal className="min-w-0 lg:col-span-2">
          <CodeBlock file="payload.config.ts">
            {k('import')} {p('{')} clockPlugin, clockAccess {p('}')} {k('from')}{' '}
            {str("'@payload-solutions/plugin-clock'")}
            {'\n\n'}
            {k('export default')} buildConfig({p('{')}
            {'\n'}
            {'  '}plugins: {p('[')}clockPlugin({p('{')} projectToken: process.env.PAYLOAD_CLOCK_TOKEN {p('}')}){p(']')},
            {'\n'}
            {'  '}jobs: {p('{')}
            {'\n'}
            {'    '}{c('// Clock signs every request; the plugin checks the signature.')}
            {'\n'}
            {'    '}access: {p('{')} run: clockAccess() {p('}')},
            {'\n'}
            {'  '}{p('}')},
            {'\n'}
            {p('}')})
          </CodeBlock>

          <CodeBlock file="without the plugin" className="mt-10">
            {k('export default')} buildConfig({p('{')}
            {'\n'}
            {'  '}jobs: {p('{')}
            {'\n'}
            {'    '}access: {p('{')}
            {'\n'}
            {'      '}run: ({p('{')} req {p('}')}) =&gt;
            {'\n'}
            {'        '}req.headers.get({str("'authorization'")}) === {str('`Bearer ${process.env.CLOCK_SECRET}`')},
            {'\n'}
            {'    '}{p('}')},
            {'\n'}
            {'  '}{p('}')},
            {'\n'}
            {p('}')})
          </CodeBlock>
        </Reveal>
      </div>
    </section>
  )
}
