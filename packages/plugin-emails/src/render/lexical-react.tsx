import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { ReactNode } from 'react'

import { Button, Heading, Hr, Link, Section, Text } from '@react-email/components'
import React from 'react'

import type { TemplateStyles, VariableManifest, VariableType } from '../types.js'

import { formatValue, TOKEN_PATTERN } from './interpolate.js'
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
  dateFormat?: Intl.DateTimeFormatOptions
  locale?: string
  manifest?: VariableManifest
  styles?: Partial<TemplateStyles>
  variables: Record<string, unknown>
}

/**
 * Replace `{{tokens}}` inside one text run, returning React nodes. Values are escaped by React;
 * only `html`-typed variables (which only code can produce) are inserted as markup.
 */
export function interpolateToNodes(text: string, options: ReactRenderOptions): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const [full, escaped, name] = match
    const start = match.index ?? 0
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start))
    }
    lastIndex = start + full.length
    if (escaped) {
      nodes.push(full.slice(1))
      continue
    }
    const type: undefined | VariableType = options.manifest?.[name]?.type
    if (!Object.prototype.hasOwnProperty.call(options.variables, name)) {
      continue
    }
    const value = formatValue(options.variables[name], type, {
      dateFormat: options.dateFormat,
      locale: options.locale,
    })
    if (type === 'html') {
      nodes.push(<span dangerouslySetInnerHTML={{ __html: value }} key={`v${key++}`} />)
    } else {
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
        style={{ backgroundColor: '#f4f4f5', borderRadius: '3px', fontSize: '14px', padding: '1px 4px' }}
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

function inlineChildren(children: AnyNode[] | undefined, options: ReactRenderOptions, styles: TemplateStyles): ReactNode[] {
  return (children ?? []).map((child, i) => {
    switch (child.type) {
      case 'autolink':
      case 'link': {
        const url = typeof child.fields?.url === 'string' ? child.fields.url : ''
        const href = interpolateToNodes(url, options).join('')
        return (
          <Link className={EMAIL_CLASS.link} href={href} key={i} style={styles.link} target="_blank">
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
        return child.children ? <React.Fragment key={i}>{inlineChildren(child.children, options, styles)}</React.Fragment> : null
    }
  })
}

function buttonBlock(fields: Record<string, unknown>, options: ReactRenderOptions, styles: TemplateStyles, key: number) {
  const label = interpolateToNodes(String(fields.label ?? ''), options)
  const href = interpolateToNodes(String(fields.url ?? ''), options).join('')
  const centered = fields.align === 'center'
  return (
    <Section key={key} style={{ margin: '24px 0', textAlign: centered ? 'center' : 'left' }}>
      <Button className={EMAIL_CLASS.button} href={href} style={{ ...styles.button, display: 'inline-block' }}>
        {label}
      </Button>
    </Section>
  )
}

function blockNode(node: AnyNode, options: ReactRenderOptions, styles: TemplateStyles, key: number): ReactNode {
  switch (node.type) {
    case 'block': {
      const fields = (node.fields ?? {})
      if (fields.blockType === 'button') {
        return buttonBlock(fields, options, styles, key)
      }
      return null
    }
    case 'heading': {
      const tag = (node.tag as 'h1' | 'h2' | 'h3') ?? 'h2'
      const style = tag === 'h1' ? styles.h1 : tag === 'h3' ? styles.h3 : styles.h2
      return (
        <Heading as={tag} className={EMAIL_CLASS.heading} key={key} style={{ ...style, color: styles.text.color }}>
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
        <blockquote className={EMAIL_CLASS.quote} key={key} style={{ ...styles.text, ...styles.blockquote }}>
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
