import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Access, CollectionSlug, Config, Payload, PayloadRequest } from 'payload'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

import type { ResendClient } from './resend/client.js'

export type MaybePromise<T> = Promise<T> | T

// ---------------------------------------------------------------------------------------------
// Sources: collections whose documents are subscribers
// ---------------------------------------------------------------------------------------------

/** A value pushed to Resend as a custom contact property and usable as `{{key}}` in campaigns. */
export type ContactPropertyDefinition = {
  /** Shown next to the token in the Preview & send tab. */
  description?: string
  /** Used by Resend (and by the preview) when a contact has no value. Must match `type`. */
  fallback?: number | string
  type: 'number' | 'string'
  /** Reads the value from a subscriber document. Return null/undefined to leave it empty. */
  value: (args: { doc: Record<string, unknown> }) => unknown
}

export type SourceFieldMap = {
  /** Path of the email field. Default `email`. Auth collections already have one. */
  email?: string
  /** Path of a given-name field. When set, `name` is not added and is not used for the split. */
  firstName?: string
  lastName?: string
  /** Path of a full-name field, split on the first space into first/last name. Default `name`. */
  name?: string
  /** Path of the checkbox that says whether this subscriber receives newsletters. Default `subscribed`. */
  subscribed?: string
}

export type SourceConfig = {
  /**
   * Add the email/name/subscribed fields when the collection does not define them. Default true.
   * Turn off if you add them yourself (for example inside a tab) and map them with `fields`.
   */
  addFields?: boolean
  collection: CollectionSlug
  /** Value of the added subscribed checkbox for new documents. Default false (opt-in). */
  defaultSubscribed?: boolean
  fields?: SourceFieldMap
  /** Label in the list editor's Source select. Defaults to the collection slug. */
  label?: string
  /** Extra per-subscriber values, pushed as Resend contact properties. Keys: letters, digits, `_`. */
  properties?: Record<string, ContactPropertyDefinition>
}

export type SanitizedSource = {
  addFields: boolean
  collection: CollectionSlug
  defaultSubscribed: boolean
  fields: Pick<SourceFieldMap, 'firstName' | 'lastName' | 'name'> &
    Required<Pick<SourceFieldMap, 'email' | 'subscribed'>>
  label?: string
  properties: Record<string, ContactPropertyDefinition>
}

/** A subscriber as the plugin sees it, independent of which collection it came from. */
export type Subscriber = {
  collection: CollectionSlug
  email: string
  firstName: string
  id: number | string
  lastName: string
  name: string
  properties: Record<string, null | number | string>
  subscribed: boolean
}

// ---------------------------------------------------------------------------------------------
// Templates (same contract as @payload-solutions/plugin-emails, so one component can serve both)
// ---------------------------------------------------------------------------------------------

export type TemplateStyles = {
  blockquote: CSSProperties
  button: CSSProperties
  /** Small print: the link repeated under a button, the unsubscribe line. */
  fine: CSSProperties
  h1: CSSProperties
  h2: CSSProperties
  h3: CSSProperties
  hr: CSSProperties
  link: CSSProperties
  list: CSSProperties
  listItem: CSSProperties
  text: CSSProperties
}

/** The Newsletter Settings global, as templates receive it. */
export type NewsletterSettings = {
  /** Editable footer under every campaign. Variables are allowed. */
  footer?: null | SerializedEditorState
  from?: string
  replyTo?: string
  siteName?: string
  siteUrl?: string
  testRecipient?: string
  /** Text of the unsubscribe link the plugin adds under the footer. Default "Unsubscribe". */
  unsubscribeLabel?: string
}

export type EmailTemplateProps = {
  /** The campaign body, already rendered to React Email elements with variables filled in. */
  children: ReactNode
  /** Footer copy rendered by the plugin; the default template adds the unsubscribe link under it. */
  footer?: ReactNode
  locale?: string
  preheader?: string
  settings: NewsletterSettings
  subject: string
  /**
   * The unsubscribe URL for this render: Resend's `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder when a
   * broadcast is sent, a harmless stand-in in previews and tests. Every template MUST link to it.
   */
  unsubscribeUrl: string
  variables: Record<string, unknown>
}

export type EmailTemplate = {
  (props: EmailTemplateProps): ReactElement
  styles?: Partial<TemplateStyles>
}

// ---------------------------------------------------------------------------------------------
// Plugin options
// ---------------------------------------------------------------------------------------------

export type RequestAccess = (args: { req: PayloadRequest }) => MaybePromise<boolean>

export type ResendBroadcastsPluginOptions = {
  /** Who can read and edit lists and campaigns, and use the send endpoints. Default: any logged-in user. */
  access?: {
    /** Create/edit lists and campaigns. */
    manage?: RequestAccess
    /** Send, schedule and cancel campaigns, and run a full resync. Defaults to `manage`. */
    send?: RequestAccess
  }
  /** Admin nav group for Lists and Campaigns. Default "Newsletter". */
  adminGroup?: string
  /** Resend API key. Default `process.env.RESEND_API_KEY`. */
  apiKey?: string
  /**
   * Images in campaigns. Name an upload collection and the body editor gets an Image block.
   * Mail clients fetch images from the internet, so a relative upload URL is prefixed with
   * `baseUrl` (default: the server URL), and a broadcast whose images are not public — a relative
   * URL, `localhost`, a private address — is refused unless `allowPrivateUrls` is set.
   */
  media?: { allowPrivateUrls?: boolean; baseUrl?: string; collection: string }
  /** Deletes the Resend contact when its last subscriber document is deleted. Default true. */
  deleteContacts?: boolean
  /** Keep collections and fields (for a stable schema) but skip every Resend call and endpoint. */
  disabled?: boolean
  /** Replace the Lexical editor used for the campaign body. */
  editor?: Config['editor']
  /**
   * `"Name <address>"` campaigns are sent from when neither the campaign nor Newsletter Settings
   * sets one. The address must be on a domain verified in Resend.
   */
  from?: string
  replyTo?: string | string[]
  /**
   * Resend client options. `baseUrl` points the plugin at another API host — the dev app uses it for
   * its in-memory mock. `requestsPerSecond` throttles every call this process makes (Resend's
   * default team limit is 2/s); 429s are retried with backoff.
   */
  resend?: { baseUrl?: string; client?: ResendClient; requestsPerSecond?: number }
  /** Override the generated collection and global slugs. */
  slugs?: { campaigns?: string; lists?: string; settings?: string; syncRuns?: string }
  sources: SourceConfig[]
  /**
   * `await` (default) runs contact and segment sync inside the save, so a failure is logged before
   * the request returns. `background` fires it after the response, which keeps saves fast but can be
   * cut off on serverless hosts.
   */
  syncMode?: 'await' | 'background'
  templates?: Record<string, EmailTemplate>
  /** Values usable as `{{key}}` in every campaign, inlined at send time (the same for everyone). */
  variables?:
    | ((args: { payload: Payload }) => MaybePromise<Record<string, number | string>>)
    | Record<string, number | string>
  /** Signing secret of the Resend webhook (`whsec_…`). Default `process.env.RESEND_WEBHOOK_SECRET`. */
  webhookSecret?: string
}

export type SanitizedOptions = {
  access: { manage: RequestAccess; send: RequestAccess }
  adminGroup: string
  apiKey?: string
  deleteContacts: boolean
  disabled: boolean
  editor?: ResendBroadcastsPluginOptions['editor']
  from?: string
  media?: { allowPrivateUrls: boolean; baseUrl?: string; collection: string }
  properties: Record<string, Omit<ContactPropertyDefinition, 'value'>>
  replyTo?: string | string[]
  resend: NonNullable<ResendBroadcastsPluginOptions['resend']>
  slugs: { campaigns: string; lists: string; settings: string; syncRuns: string }
  sources: SanitizedSource[]
  syncMode: 'await' | 'background'
  templates: Record<string, EmailTemplate>
  variables?: ResendBroadcastsPluginOptions['variables']
  webhookSecret?: string
}

// ---------------------------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------------------------

export type CampaignStatus = 'draft' | 'failed' | 'scheduled' | 'sending' | 'sent'

export type ListDoc = {
  description?: null | string
  filter?: null | Record<string, unknown>
  id: number | string
  lastSyncedAt?: null | string
  memberCount?: null | number
  name: string
  segmentId?: null | string
  source: string
  syncError?: null | string
}

export type CampaignDoc = {
  body?: null | SerializedEditorState
  broadcastId?: null | string
  from?: null | string
  id: number | string
  lastError?: null | string
  list?: ListDoc | null | number | string
  name: string
  previewText?: null | string
  replyTo?: null | string
  scheduledAt?: null | string
  sentAt?: null | string
  status?: CampaignStatus | null
  subject: string
  template?: null | string
}

export type SyncRunDoc = {
  errors?: null | string[]
  finishedAt?: null | string
  id: number | string
  scope: 'all' | 'list'
  stats?: null | Record<string, number>
  status: 'failed' | 'finished' | 'running'
}

// ---------------------------------------------------------------------------------------------
// Rendering and the runtime API
// ---------------------------------------------------------------------------------------------

/**
 * `preview` resolves every token from one subscriber (tests and the admin preview); `broadcast`
 * turns per-subscriber tokens into Resend placeholders so Resend fills them in for each contact.
 */
export type RenderMode = 'broadcast' | 'preview'

export type RenderedCampaign = {
  html: string
  /** Images Payload serves only to logged-in users, which no inbox could load. */
  loginRequiredImages?: string[]
  preheader?: string
  subject: string
  text: string
  /** Every token the copy uses, with the value this render gave it. */
  variables: Record<string, string>
}

export type VariableInfo = {
  description?: string
  /** What the token becomes in a broadcast — a Resend placeholder or an inlined value. */
  resend: string
  token: string
  type: 'global' | 'property' | 'subscriber'
}

export type ResyncResult = {
  contactsCreated: number
  contactsUpdated: number
  errors: string[]
  pulledUnsubscribes: number
  segmentAdds: number
  segmentRemovals: number
}

export type ResendBroadcastsAPI = {
  cancel: (campaignId: number | string) => Promise<CampaignDoc>
  client: ResendClient
  /** Resolves once every background sync and resync started by this process has finished. */
  idle: () => Promise<void>
  options: SanitizedOptions
  refreshStatus: (campaignId: number | string) => Promise<CampaignDoc>
  render: (args: {
    campaign: CampaignDoc | number | string
    mode?: RenderMode
    subscriber?: Subscriber
  }) => Promise<RenderedCampaign>
  /**
   * Reconcile Resend with the source collections. Pass list ids to limit it to those segments, and
   * `force` to update every existing contact (and its properties), not only the ones that drifted.
   */
  resync: (args?: {
    force?: boolean
    lists?: Array<number | string>
    req?: PayloadRequest
  }) => Promise<ResyncResult>
  send: (
    campaignId: number | string,
    args?: { scheduledAt?: Date | string },
  ) => Promise<CampaignDoc>
  /** Push one document to Resend now (contact + segment membership). */
  syncDocument: (args: {
    collection: CollectionSlug
    doc: Record<string, unknown>
    req?: PayloadRequest
  }) => Promise<void>
}

export type { Access }
