import { SectionHead } from '@payload-solutions/brand/lattice'
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
        <Reveal>
          <SectionHead
            id="showcase-heading"
            title="Your product in front. Payload behind it."
            lead="The dashboard your users sign in to and the admin your team works in read the same collections, the same session and the same config."
          />
        </Reveal>

        <Reveal className="mt-14 lg:mt-20">
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
