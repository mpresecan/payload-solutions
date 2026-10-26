import { ActionRow, SectionHead } from '@payload-solutions/brand/lattice'
import { GridCross } from '@payload-solutions/brand/crosshairs'
import { Reveal } from '@/components/reveal'
import { ContactForm } from './contact-form'

const OFFERS: Array<{ title: string; body: string }> = [
  {
    title: 'A SaaS in weeks, not quarters',
    body: 'We start from Payload Stack, so authentication, organizations, billing and the admin are done on day one. Your budget goes into the product.',
  },
  {
    title: 'Migrations and rescues',
    body: 'Moving off WordPress, Strapi, Contentful or a custom backend to Payload, with data, access control and editors carried over.',
  },
  {
    title: 'Plugins and integrations',
    body: 'Custom Payload plugins, Stripe and Better Auth integrations, job queues, Vercel deployments. Open source where the community benefits.',
  },
]

export interface ContactProps {
  eyebrow?: string
  title?: string
  lead?: string
  /** Recorded with the submission: which page the enquiry came from. */
  source?: string
  /** The "Read our case studies" row under the offers. Off on the case study pages themselves. */
  caseStudiesLink?: boolean
}

/**
 * The enquiry block. The home page uses the defaults; a case study passes its own closing
 * prompt and a `source`, so the inbox shows which write-up a lead read before writing.
 */
export function Contact({
  eyebrow = 'Work with us',
  title = 'Need it built? We build SaaS on Payload.',
  lead = 'The same team that maintains these products takes on a few client projects at a time.',
  source = 'home',
  caseStudiesLink = true,
}: ContactProps = {}) {
  return (
    <section id="contact" className="scroll-mt-header relative hairline-t py-section" aria-labelledby="contact-heading">
      <GridCross line={4} />
      <div className="container-content col-grid gap-y-12">
        <div className="lg:col-span-2 lg:pr-12">
          <Reveal>
            <SectionHead
              id="contact-heading"
              eyebrow={eyebrow}
              title={title}
              lead={lead}
            />
          </Reveal>
          <ul className="mt-12">
            {OFFERS.map((offer, i) => (
              <Reveal as="li" key={offer.title} index={i} className="border-t border-border py-6">
                <h3 className="display-sm">{offer.title}</h3>
                <p className="mt-1.5 max-w-[46ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">{offer.body}</p>
              </Reveal>
            ))}
          </ul>
          {/* Proof sits behind one row rather than a home page section, so no single client
              gets the spotlight; a carousel can replace it once there are several studies. */}
          {caseStudiesLink ? (
            <Reveal className="border-t border-border">
              <ActionRow href="/case-studies">Read our case studies</ActionRow>
            </Reveal>
          ) : null}
        </div>
        <Reveal className="min-w-0 lg:col-span-2">
          <ContactForm source={source} />
        </Reveal>
      </div>
    </section>
  )
}
