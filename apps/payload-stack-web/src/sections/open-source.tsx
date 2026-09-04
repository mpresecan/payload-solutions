import { SOLUTIONS_URL, brands } from '@payload-solutions/brand'
import { CopyCommand } from '@/components/copy-command'
import { Reveal } from '@/components/reveal'
import { Button } from '@/components/ui/button'

const brand = brands.stack

export function OpenSource() {
  return (
    <section className="hairline-t" aria-labelledby="oss-heading">
      <div className="container-content py-section">
        <Reveal className="grid grid-cols-1 gap-10 border border-border bg-surface p-8 lg:grid-cols-12 lg:items-end lg:gap-8 lg:p-12">
          <div className="lg:col-span-7">
            <h2 id="oss-heading" className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl">
              Open source, MIT licensed, built in the open.
            </h2>
            <p className="mt-5 max-w-[52ch] text-pretty text-lg leading-relaxed text-fg-muted">
              Payload Stack is a payload.solutions project. Follow the roadmap, open an issue, or
              hire the team behind it to build on your stack.
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-3 lg:col-span-5 lg:items-end">
            <CopyCommand size="lg" />
            <div className="flex flex-wrap gap-3">
              <Button href={brand.github} variant="secondary" arrow>
                GitHub
              </Button>
              <Button href={`${SOLUTIONS_URL}/#contact`} variant="ghost" arrow>
                Hire us
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
