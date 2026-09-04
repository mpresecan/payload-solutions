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

export function Contact() {
  return (
    <section id="contact" className="scroll-mt-header hairline-t py-section" aria-labelledby="contact-heading">
      <div className="container-content grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <Reveal>
            <h2 id="contact-heading" className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl">
              Need it built? We build SaaS on Payload.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-fg-muted">
              The same team that maintains these products takes on a few client projects at a time.
            </p>
          </Reveal>
          <ul className="mt-10">
            {OFFERS.map((offer, i) => (
              <Reveal as="li" key={offer.title} index={i} className="border-t border-border py-6">
                <h3 className="text-lg font-medium leading-snug tracking-tight">{offer.title}</h3>
                <p className="mt-1.5 max-w-[46ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">{offer.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal className="min-w-0 lg:col-span-7">
          <ContactForm />
        </Reveal>
      </div>
    </section>
  )
}
