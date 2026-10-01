import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { ReactNode } from 'react'

import { Button, Heading, Hr, Img, Link, Section, Text } from '@react-email/components'
import React from 'react'

import type { TemplateStyles } from '../types.js'
import type { ImageWidth } from '../editor/image-block.js'
import type { MediaDoc } from './images.js'
import type { TokenResolver } from './interpolate.js'

import { IMAGE_BLOCK_SLUG, IMAGE_WIDTHS } from '../editor/image-block.js'
import { cleanFallback, TOKEN_PATTERN } from './interpolate.js'
import { defaultStyles, EMAIL_CLASS } from './template.js'

// Lexical text format bitmask
const IS_BOLD = 1
const IS_ITALIC = 2
const IS_STRIKETHROUGH = 4
const IS_UNDERLINE = 8
const IS_CODE = 16

type AnyNode = {
  [key: string]: unknown
  children?: AnyNode[]
  fields?: Record<string, unknown>
  format?: number | string
  listType?: string
  tag?: string
  text?: string
  type: string
}

export type ReactRenderOptions = {
  /** Turns an upload's URL into one a mail client can load. */
  imageUrl?: (url: string) => string
  resolve: TokenResolver
  styles?: Partial<TemplateStyles>
}

/**
 * Replace `{{tokens}}` inside one text run, returning React nodes. Values are plain strings escaped
 * by React — in a broadcast they are Resend placeholders, which contain no characters React escapes.
 */
export function interpolateToNodes(text: string, options: ReactRenderOptions): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const [full, escaped, name, fallback] = match
    const start = match.index ?? 0
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start))
    }
    lastIndex = start + full.length
    if (escaped) {
      nodes.push(full.slice(1))
      continue
    }
    const value = options.resolve(name, cleanFallback(fallback))
    if (value) {
      nodes.push(value)
    }
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

function textNode(node: AnyNode, options: ReactRenderOptions, key: number): ReactNode {
  const format = typeof node.format === 'number' ? node.format : 0
  let content: ReactNode = interpolateToNodes(node.text ?? '', options)
  if (format & IS_CODE) {
    content = (
      <code
        className={EMAIL_CLASS.code}
        style={{
          backgroundColor: '#f4f4f5',
          borderRadius: '3px',
          fontSize: '14px',
          padding: '1px 4px',
        }}
      >
        {content}
      </code>
    )
  }
  if (format & IS_BOLD) {
    content = <strong>{content}</strong>
  }
  if (format & IS_ITALIC) {
    content = <em>{content}</em>
  }
  if (format & IS_UNDERLINE) {
    content = <u>{content}</u>
  }
  if (format & IS_STRIKETHROUGH) {
    content = <s>{content}</s>
  }
  return <React.Fragment key={key}>{content}</React.Fragment>
}

function inlineChildren(
  children: AnyNode[] | undefined,
  options: ReactRenderOptions,
  styles: TemplateStyles,
): ReactNode[] {
  return (children ?? []).map((child, i) => {
    switch (child.type) {
      case 'autolink':
      case 'link': {
        const url = typeof child.fields?.url === 'string' ? child.fields.url : ''
        const href = interpolateToNodes(url, options).join('')
        return (
          <Link
            className={EMAIL_CLASS.link}
            href={href}
            key={i}
            style={styles.link}
            target="_blank"
          >
            {inlineChildren(child.children, options, styles)}
          </Link>
        )
      }
      case 'linebreak':
        return <br key={i} />
      case 'tab':
        return <React.Fragment key={i}>{'  '}</React.Fragment>
      case 'text':
        return textNode(child, options, i)
      default:
        return child.children ? (
          <React.Fragment key={i}>{inlineChildren(child.children, options, styles)}</React.Fragment>
        ) : null
    }
  })
}

/**
 * The call-to-action, and — unless the block turns it off — the same URL repeated underneath as
 * plain text. Plain text on purpose: if the button did not work, a second link would not either,
 * and what the reader needs is something they can select and paste.
 */
/**
 * An upload from the media collection, at a width that fits the content column (and never wider
 * than the file itself), with an absolute URL. `width` is set as an attribute as well as in the
 * style because Outlook ignores CSS widths on images.
 */
function imageBlock(
  fields: Record<string, unknown>,
  options: ReactRenderOptions,
  styles: TemplateStyles,
  key: number,
): ReactNode {
  const media = fields.image as MediaDoc | null | number | string | undefined
  if (!media || typeof media !== 'object' || !media.url) {
    return null
  }
  const target =
    IMAGE_WIDTHS[
      (fields.width as ImageWidth) in IMAGE_WIDTHS ? (fields.width as ImageWidth) : 'full'
    ]
  const width = media.width ? Math.min(target, media.width) : target
  const height =
    media.width && media.height ? Math.round((width * media.height) / media.width) : undefined
  const centered = fields.width === 'full' || fields.align !== 'left'
  const alt =
    typeof fields.alt === 'string' && fields.alt.trim() ? fields.alt.trim() : (media.alt ?? '')
  const href =
    typeof fields.href === 'string' && fields.href
      ? interpolateToNodes(fields.href, options).join('')
      : ''
  const image = (
    <Img
      alt={alt}
      className={EMAIL_CLASS.image}
      height={height}
      src={options.imageUrl ? options.imageUrl(media.url) : media.url}
      style={{
        border: 0,
        display: 'block',
        height: 'auto',
        margin: centered ? '0 auto' : '0',
        maxWidth: '100%',
        outline: 'none',
        textDecoration: 'none',
        width: `${width}px`,
      }}
      width={width}
    />
  )
  return (
    <Section key={key} style={{ margin: '24px 0', textAlign: centered ? 'center' : 'left' }}>
      {href ? (
        <Link href={href} target="_blank">
          {image}
        </Link>
      ) : (
        image
      )}
      {typeof fields.caption === 'string' && fields.caption.trim() ? (
        <Text className={EMAIL_CLASS.fine} style={{ ...styles.fine, margin: '8px 0 0' }}>
          {interpolateToNodes(fields.caption, options)}
        </Text>
      ) : null}
    </Section>
  )
}

function buttonBlock(
  fields: Record<string, unknown>,
  options: ReactRenderOptions,
  styles: TemplateStyles,
  key: number,
) {
  const label = interpolateToNodes(String(fields.label ?? ''), options)
  const href = interpolateToNodes(String(fields.url ?? ''), options).join('')
  const centered = fields.align === 'center'
  const showFallback = fields.fallback !== false
  const fallbackText = String(fields.fallbackText ?? '')
  return (
    <Section key={key} style={{ margin: '24px 0', textAlign: centered ? 'center' : 'left' }}>
      <Button
        className={EMAIL_CLASS.button}
        href={href}
        style={{ ...styles.button, display: 'inline-block' }}
      >
        {label}
      </Button>
      {showFallback && href ? (
        <>
          {fallbackText ? (
            <Text className={EMAIL_CLASS.fine} style={{ ...styles.fine, margin: '18px 0 2px' }}>
              {interpolateToNodes(fallbackText, options)}
            </Text>
          ) : null}
          <Text
            className={EMAIL_CLASS.fine}
            style={{ ...styles.fine, margin: fallbackText ? 0 : '18px 0 0' }}
          >
            {href}
          </Text>
        </>
      ) : null}
    </Section>
  )
}

function blockNode(
  node: AnyNode,
  options: ReactRenderOptions,
  styles: TemplateStyles,
  key: number,
): ReactNode {
  switch (node.type) {
    case 'block': {
      const fields = node.fields ?? {}
      if (fields.blockType === 'button') {
        return buttonBlock(fields, options, styles, key)
      }
      if (fields.blockType === IMAGE_BLOCK_SLUG) {
        return imageBlock(fields, options, styles, key)
      }
      return null
    }
    case 'heading': {
      const tag = (node.tag as 'h1' | 'h2' | 'h3') ?? 'h2'
      const style = tag === 'h1' ? styles.h1 : tag === 'h3' ? styles.h3 : styles.h2
      return (
        <Heading
          as={tag}
          className={EMAIL_CLASS.heading}
          key={key}
          style={{ ...style, color: styles.text.color }}
        >
          {inlineChildren(node.children, options, styles)}
        </Heading>
      )
    }
    case 'horizontalrule':
      return <Hr className={EMAIL_CLASS.hr} key={key} style={styles.hr} />
    case 'list': {
      const ordered = node.listType === 'number'
      const Tag = ordered ? 'ol' : 'ul'
      return (
        <Tag className={EMAIL_CLASS.list} key={key} style={{ ...styles.text, ...styles.list }}>
          {(node.children ?? []).map((item, i) => (
            <li className={EMAIL_CLASS.listItem} key={i} style={styles.listItem}>
              {inlineChildren(item.children, options, styles)}
            </li>
          ))}
        </Tag>
      )
    }
    case 'paragraph': {
      if (!node.children?.length) {
        return null
      }
      return (
        <Text className={EMAIL_CLASS.text} key={key} style={styles.text}>
          {inlineChildren(node.children, options, styles)}
        </Text>
      )
    }
    case 'quote':
      return (
        <blockquote
          className={EMAIL_CLASS.quote}
          key={key}
          style={{ ...styles.text, ...styles.blockquote }}
        >
          {inlineChildren(node.children, options, styles)}
        </blockquote>
      )
    default:
      return node.children ? (
        <React.Fragment key={key}>
          {node.children.map((child, i) => blockNode(child, options, styles, i))}
        </React.Fragment>
      ) : null
  }
}

/** Lexical state → React Email elements, with `{{variables}}` filled in as it goes. */
export function lexicalToReact(
  data: null | SerializedEditorState | undefined,
  options: ReactRenderOptions,
): ReactNode {
  const styles: TemplateStyles = { ...defaultStyles, ...(options.styles ?? {}) }
  const root = data?.root as AnyNode | undefined
  if (!root?.children?.length) {
    return null
  }
  return <>{root.children.map((child, i) => blockNode(child, options, styles, i))}</>
}
