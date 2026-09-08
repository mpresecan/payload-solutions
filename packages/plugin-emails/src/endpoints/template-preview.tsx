import type { Endpoint } from 'payload'

import { Heading, Text } from '@react-email/components'
import { render } from '@react-email/render'
import React from 'react'

import type { SanitizedEmailsPluginOptions, TemplateStyles } from '../types.js'

import { lexicalToReact } from '../render/lexical-react.js'
import { DEFAULT_GLOBAL_MANIFEST, getSettings } from '../render/render.js'
import { defaultStyles, EMAIL_CLASS, templatePreviewCopy } from '../render/template.js'

export const TEMPLATE_PREVIEW_PATH = '/email-templates/preview'

/**
 * `POST /api/email-templates/preview` → `{ html, templates }`.
 *
 * Renders a template with placeholder copy so editors can see the design their words land in —
 * and see that it is not something they change here.
 */
export function createTemplatePreviewEndpoint(options: SanitizedEmailsPluginOptions): Endpoint {
  return {
    handler: async (req) => {
      if (!req.user) {
        return Response.json({ message: 'Unauthorized' }, { status: 401 })
      }
      let body: { template?: string } = {}
      try {
        body = ((await req.json?.()) ?? {}) as { template?: string }
      } catch {
        body = {}
      }
      const names = Object.keys(options.templates)
      const name = body.template && options.templates[body.template] ? body.template : 'default'
      const template = options.templates[name]!
      const styles: TemplateStyles = { ...defaultStyles, ...(template.styles ?? {}) }

      const settings = await getSettings({ options, payload: req.payload, req })
      const variables = {
        'site.name': settings.siteName ?? '',
        'site.url': settings.siteUrl ?? '',
        'support.email': settings.replyTo ?? settings.from?.address ?? '',
        year: new Date().getFullYear(),
      }

      const children = (
        <>
          <Heading
            as="h2"
            className={EMAIL_CLASS.heading}
            style={{ ...styles.h2, color: styles.text.color, marginTop: 0 }}
          >
            {templatePreviewCopy.heading}
          </Heading>
          {templatePreviewCopy.body.split('\n\n').map((paragraph, i) => (
            <Text className={EMAIL_CLASS.text} key={i} style={styles.text}>
              {paragraph}
            </Text>
          ))}
        </>
      )

      const footer = settings.footer
        ? lexicalToReact(settings.footer, { manifest: DEFAULT_GLOBAL_MANIFEST, styles: template.styles, variables })
        : null

      const html = await render(
        template({
          children,
          footer,
          locale: (req.locale as string | undefined) ?? undefined,
          preheader: undefined,
          settings,
          subject: templatePreviewCopy.subject,
          variables,
        }),
      )

      return Response.json({ html, template: name, templates: names })
    },
    method: 'post',
    path: TEMPLATE_PREVIEW_PATH,
  }
}
