import { h2, p, richText, ul } from '../lexical'

/**
 * The first case study: Layron, Layer Finance's AI workspace for real estate deals.
 *
 * Facts about the client come from layron.ai and layerfinance.com (October 2026). The story is
 * Michael's own account of the engagement. The one quote and the 80% figure are Layer Finance's
 * published words, linked to where they were published — nothing here is put in their mouth.
 */
export const layronCaseStudy = {
  title: 'Six months on extraction. Three weeks to a product that beat it.',
  slug: 'layron',
  client: 'Layer Finance · Layron',
  clientUrl: 'https://www.layron.ai',
  publishedAt: '2026-10-26T09:00:00.000Z',
  featured: true,
  summary:
    'Layer Finance had spent six months trying to get document extraction right for Layron, its AI workspace for real estate deals. I rebuilt it in three weeks on the foundation that became Payload Stack: the prototype beat the existing pipeline, shipped more of the product, and the whole platform moved onto it.',
  industry: 'Institutional real estate',
  location: 'Baar, Switzerland · Vienna, Austria',
  engagement: 'Consulting · 3 weeks to prototype',
  author: 'Michael Presecan',
  outcomes: [
    { value: '3 weeks', label: 'From kick-off to a working prototype running the full extraction pipeline' },
    { value: '6 months', label: 'Of in-house work on extraction that the prototype outperformed' },
    { value: '1 stack', label: 'Layron’s entire product pivoted onto Payload Stack' },
    { value: '80%', label: 'Time saved during deal onboarding', source: 'Measured by Layer Finance, published on layron.ai' },
  ],
  builtWith: [
    { name: 'Payload Stack' },
    { name: 'Payload CMS' },
    { name: 'Next.js' },
    { name: 'Better Auth' },
    { name: 'shadcn/ui' },
  ],
  quote: {
    text: 'We measured 80% time saved during deal onboarding.',
    author: 'Kurt Praszl',
    role: 'Head of Investment, Layer Finance',
    sourceUrl: 'https://www.layron.ai',
  },
  cta: {
    title: 'Months in, and the hard part still isn’t working?',
    body: 'Tell us what you are building and where it is stuck. We start from Payload Stack, so the engagement goes into the part only your product has.',
  },
  content: richText(
    h2('The client'),
    p(
      '[Layer Finance](https://www.layerfinance.com) works on the institutional side of real estate. It sources off-market deals for investors, arranges senior debt, mezzanine and equity for sponsors, and structures real estate into securities, from offices in Baar and Vienna.',
    ),
    p(
      'Underneath all of it sits [Layron](https://www.layron.ai), Layer Finance’s own AI workspace for deal teams. A deal comes in and Layron turns it into an investor-ready brief. It sorts the data room, reads the rent rolls, leases and financials, flags the risks, scores the deal against the investor’s criteria and drafts the fact sheet. Every figure can be traced back to the page it came from. Layer Finance runs its own business on it and licenses it to other deal teams.',
    ),

    h2('Everything depends on extraction'),
    p(
      'A real estate deal arrives as a pile of documents: an information memorandum, rent rolls, leases and financial statements. They often run to hundreds of pages, in whatever format the seller happened to use. Before anyone can score the deal, model it or write the brief, the numbers have to come out of those documents correctly.',
    ),
    p(
      'That makes extraction the foundation of the whole product. When it is wrong, everything built on top of it is wrong too, and wrong with confidence. A deal score built on a misread rent roll is worse than no score at all.',
    ),
    p(
      'When I joined as a consultant, the team had been working on this for six months. Extraction still was not where the product needed it to be, and the rest of the roadmap was waiting on it.',
    ),

    h2('Three weeks, and a different starting line'),
    p(
      'I had three weeks. The useful question was not how to work faster than a team of engineers. It was how to spend almost none of those three weeks on anything except the problem.',
    ),
    p(
      'So I did not start from an empty repository. I started from my own SaaS foundation, the one I have since open-sourced as [Payload Stack](https://www.payloadstack.com). On the first day, before any AI work, the prototype already had:',
    ),
    ul(
      '**Sign-in** for users and administrators, with sessions, roles and secure defaults',
      '**Organizations**, so every deal team works in its own space and sees only its own deals',
      '**A data model written in code**, typed end to end, for deals, documents and everything extracted from them',
      '**A full admin panel** to inspect, correct and audit every record the AI produced',
      '**A dashboard and billing**, so the product could be put in front of real users',
    ),
    p(
      'None of that is what Layron is for. All of it has to exist before anyone can use Layron. With it already in place, the three weeks went to the two things that mattered: the AI research behind extraction, and the product built around it.',
    ),

    h2('What three weeks produced'),
    p(
      'By the end of the third week, the prototype ran the entire extraction pipeline on real deal documents and outperformed the system the team had been building. It also covered more of the product than had been built in the previous six months. I had spent the time on features rather than foundations.',
    ),
    p(
      'The prototype was adopted, and then the decision went further: Layer Finance pivoted its entire solution onto Payload Stack. Layron as its customers use it today runs on that same foundation. That includes the deal cockpit, data room ingestion, agentic due diligence, deal scoring, and the fact sheets and investment memoranda generated from each firm’s own templates.',
    ),

    h2('Why it worked'),
    p(
      '**The scarce weeks went to what only this product could do.** For Layron, that was extraction quality. Authentication, multi-tenancy and an admin panel are not an advantage over anyone; they are the price of entry. Every week spent rebuilding them is a week the hard problem waits.',
    ),
    p(
      '**The admin panel is part of an AI product, not an extra.** AI extraction needs people in the loop. Someone has to check a value, correct it and see where it came from, and high-stakes decisions go to a human for review. Payload gives you that back office from the start, working on the same data as the app, so the review workflow was there from day one instead of becoming another project.',
    ),
    p(
      '**The prototype was something a team could take over.** A prototype only its author understands is a demo. This one was built on a conventional, documented stack: Payload, Next.js and TypeScript all the way through. That meant the team could pick it up and build the real product on it, which is exactly what they did.',
    ),

    h2('Is your product stuck in the plumbing?'),
    p(
      'Layron’s situation is common. A capable team is months in, the core of the product still is not working, and the calendar keeps filling with authentication, tenancy, billing and internal tools. That is the situation this kind of engagement is built for. We start from Payload Stack and spend the time on the part only your product has.',
    ),
    ul(
      '**AI products where the pipeline is the product**: document extraction, deal and contract analysis, agents that act on your data',
      '**Prototypes that need to become a real multi-tenant SaaS** without a rewrite',
      '**Teams moving an internal tool or a fragile backend onto Payload**, with data, access control and editors carried over',
    ),
    p('If that sounds like your roadmap, tell us where it is stuck. The form is right below.'),
  ),
}
