import { MediaStack } from '@payload-solutions/brand/media-stack'
import { screens } from '@payload-solutions/brand/screens'
import { ThemedImage } from '@payload-solutions/brand/themed-image'
import { Reveal } from '@/components/reveal'

const SIZES = '(min-width: 1280px) 1024px, 90vw'

/**
 * The product, twice: the dashboard users get and the Payload admin the team runs, layered
 * because they are the same collections and the same session. Sits inside the dark band on
 * the ambient backdrop; the images are the dark variants there.
 */
export function Showcase() {
  return (
    <section className="relative py-section" aria-labelledby="showcase-heading">
      <div className="container-content">
        <Reveal className="max-w-2xl">
          <h2
            id="showcase-heading"
            className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl"
          >
            Your product in front. Payload behind it.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-fg-muted">
            The dashboard your users sign in to and the admin your team works in read the same
            collections, the same session and the same config.
          </p>
        </Reveal>

        <Reveal className="mt-12 lg:mt-16">
          <MediaStack
            texture={false}
            back={
              <ThemedImage
                {...screens.adminProjects}
                sizes={SIZES}
                className="block h-auto w-full"
              />
            }
            front={
              <ThemedImage {...screens.projects} sizes={SIZES} className="block h-auto w-full" />
            }
          />
        </Reveal>
      </div>
    </section>
  )
}
