import { defineConfig } from 'fumadocs-mdx/config'

/**
 * Global MDX options for the docs collection declared in `src/lib/source.ts` (fumadocs-mdx/macro).
 * JSX blocks such as <Cards> are left out of the search index; their text lives on the linked pages.
 */
export default defineConfig({
  mdxOptions: {
    remarkStructureOptions: {
      types: ['heading', 'paragraph', 'blockquote', 'tableCell'],
    },
  },
})
