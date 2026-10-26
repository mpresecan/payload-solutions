import { Children, type CSSProperties, Fragment, type ReactNode, isValidElement } from 'react'

/*
  The hero twin of <SplitWords>: the same masked word rise (payloadcms.com's SplitAnimate),
  but driven by a CSS keyframe that runs on first paint instead of an IntersectionObserver.
  A hero headline is the page's largest paint, so it must not sit hidden until hydration.
  Server component, no JavaScript at all.

  Children may mix text and elements (the heroes link "Payload CMS"). Text is split on
  whitespace; an element is kept whole. A run with no whitespace in it — a link followed by a
  comma, say — goes into one mask, so punctuation can never wrap away from its word.

  Inside a `.reveal-load-group` the headline opts out of the group's block fade-up (see
  `.split-words--load` in css/tailwind.css); its words are the motion.
*/

type Tag = 'h1' | 'h2' | 'h3' | 'p'

export interface SplitLoadProps {
  children: ReactNode
  as?: Tag
  id?: string
  className?: string
}

export function SplitLoad({ children, as: Element = 'h1', id, className }: SplitLoadProps) {
  // Tokens: a whitespace marker, or a piece of a word (text or an element).
  const tokens: (ReactNode | null)[] = []
  Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      for (const part of String(child).split(/(\s+)/)) {
        if (part === '') continue
        tokens.push(/^\s+$/.test(part) ? null : part)
      }
    } else if (isValidElement(child)) {
      tokens.push(child)
    }
  })

  // Group consecutive non-whitespace tokens into words.
  const words: ReactNode[][] = []
  let current: ReactNode[] = []
  for (const token of tokens) {
    if (token === null) {
      if (current.length) words.push(current)
      current = []
    } else {
      current.push(token)
    }
  }
  if (current.length) words.push(current)

  return (
    <Element id={id} className={`split-words split-words--load ${className ?? ''}`}>
      {words.map((pieces, i) => (
        <span key={i}>
          <span className="split-words__mask">
            <span className="split-words__word" style={{ '--i': i } as CSSProperties}>
              {pieces.map((piece, j) => (
                <Fragment key={j}>{piece}</Fragment>
              ))}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Element>
  )
}
