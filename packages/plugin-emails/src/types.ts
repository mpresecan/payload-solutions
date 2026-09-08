import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type {
  Access,
  CollectionSlug,
  Field,
  GeneratedTypes,
  Payload,
  PayloadRequest,
  RichTextAdapterProvider,
  SendEmailOptions,
} from 'payload'

// ---------------------------------------------------------------------------------------------
// Generated-type plumbing. `payload generate:types` adds `emails` to `Config` (see typescript/schema.ts);
// everything below derives from it the same way Payload derives TypedCollection / TypedJobs.
// ---------------------------------------------------------------------------------------------

type EmailShape = { input: unknown; variables: unknown }

export type UntypedEmails = Record<
  string,
  { input: Record<string, unknown>; variables: Record<string, unknown> }
>

/** `Config['emails']` once types are generated, an open record before that. */
export type TypedEmails = GeneratedTypes extends { emails: infer E extends Record<string, EmailShape> }
  ? E
  : UntypedEmails

export type EmailSlug = keyof TypedEmails & string

export type EmailInput<S extends EmailSlug = EmailSlug> = TypedEmails[S]['input']

export type EmailVariables<S extends EmailSlug = EmailSlug> = TypedEmails[S]['variables']

// ---------------------------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------------------------

export type VariableType = 'date' | 'html' | 'number' | 'string' | 'url'

export type VariableSpec = {
  /** Shown to editors next to the variable chip. */
  description?: string
  /** Used by the preview when no sample input is available and for documentation. */
  example?: number | string
  /** Drives formatting and escaping; defaults to `string`. */
  type?: VariableType
}

export type VariableManifest = Record<string, VariableSpec>

export type EmailAudience = 'admin' | 'custom' | 'user'

/** A string, or one string per locale (`{ en: '…', de: '…' }`). */
export type LocalizedText = Record<string, string> | string

export type EmailDefaults = {
  /** Markdown (`<Button label="…" url="…" />` is allowed) or a serialized Lexical state. */
  body: LocalizedText | SerializedEditorState
  preheader?: LocalizedText
  subject: LocalizedText
}

export type MaybePromise<T> = Promise<T> | T

export type EmailSettings = {
  adminRecipients?: string[]
  /** Editable footer shown under every email. The rest of the design lives in the template. */
  footer?: null | SerializedEditorState
  from?: { address?: string; name?: string }
  replyTo?: string
  siteName?: string
  siteUrl?: string
  testRecipient?: string
}

export type ResolveArgs<S extends EmailSlug = EmailSlug> = {
  input: EmailInput<S>
  locale?: string
  payload: Payload
  req?: PayloadRequest
  settings: EmailSettings
}

export type RecipientArgs<S extends EmailSlug = EmailSlug> = {
  input: EmailInput<S>
  payload: Payload
  settings: EmailSettings
  variables: EmailVariables<S> & Record<string, unknown>
}

export type ShouldSendArgs<S extends EmailSlug = EmailSlug> = {
  definition: EmailDefinition<S>
  input: EmailInput<S>
  payload: Payload
  req?: PayloadRequest
}

export type EmailDefinition<S extends EmailSlug = EmailSlug> = {
  /** Set to allow variables whose name looks like a secret (`token`, `password`, …). */
  allowSensitiveVariables?: boolean
  /** Who receives it. `user`: code decides via `to`. `admin`: settings.adminRecipients. `custom`: editable per document. */
  audience?: EmailAudience
  /** Seeded into the document on first init and used when the document is missing. */
  defaults: EmailDefaults
  description?: string
  /** Admin grouping, e.g. `Auth`, `Billing`. */
  group?: string
  /** Payload fields describing what callers pass as `input`. Typed via generate:types. */
  inputSchema?: Field[]
  /** Overrides the generated interface name (`Email<PascalSlug>` by default). */
  interfaceName?: string
  label: string
  /** Key of a template registered in plugin options (`default` when omitted). */
  template?: string
  /** Old slugs; a document found under one of them is renamed instead of orphaned. */
  previousSlugs?: string[]
  /** Cannot be disabled in the admin (password reset, verification, receipts). */
  required?: boolean
  /** Input → variables. May return a nested object; it is flattened to dotted paths. */
  resolve?: (args: ResolveArgs<S>) => MaybePromise<EmailVariables<S>>
  /** Sample input for the preview when the editor has not saved any. */
  sample?: ((args: { payload: Payload }) => MaybePromise<EmailInput<S>>) | EmailInput<S>
  shouldSend?: (args: ShouldSendArgs<S>) => MaybePromise<boolean | { skip: string }>
  /** Stable kebab-case key. Database key and generated type key. */
  slug: S
  /** Default recipient(s). Required for `audience: 'user'` unless every call passes `to`. */
  to?: (args: RecipientArgs<S>) => MaybePromise<string | string[] | undefined>
  /** Human description of when it fires, shown in the admin. */
  trigger?: string
  /** Variables editors may use in the copy. Keys are `{{dotted.paths}}`. */
  variables?: VariableManifest
}

/** Definition with all defaults applied; what the registry stores. */
export type SanitizedEmailDefinition = {
  audience: EmailAudience
  interfaceName: string
  template: string
  variables: VariableManifest
} & Omit<EmailDefinition, 'audience' | 'interfaceName' | 'template' | 'variables'>

// ---------------------------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------------------------

/** Styles the body converter uses, so editor copy matches the template around it. */
export type TemplateStyles = {
  blockquote: CSSProperties
  button: CSSProperties
  h1: CSSProperties
  h2: CSSProperties
  h3: CSSProperties
  hr: CSSProperties
  link: CSSProperties
  list: CSSProperties
  listItem: CSSProperties
  text: CSSProperties
}

export type EmailTemplateProps = {
  /** The editor-owned copy, already rendered to React Email elements with variables filled in. */
  children: ReactNode
  definition?: SanitizedEmailDefinition
  /** The footer from Email Settings, rendered the same way. */
  footer?: ReactNode
  locale?: string
  preheader?: string
  settings: EmailSettings
  subject: string
  variables: Record<string, unknown>
}

/**
 * A React Email component every email is rendered inside. Owns the branding. Attach `styles` to
 * make the body copy match: `MyTemplate.styles = { text: { fontSize: '15px' } }`.
 */
export type EmailTemplate = {
  (props: EmailTemplateProps): ReactElement
  styles?: Partial<TemplateStyles>
}

/**
 * A serializable description of one `inputSchema` field, sent to the admin so the Preview & test
 * tab can render a real form instead of asking editors to write JSON.
 */
export type SampleFieldSpec = {
  defaultValue?: unknown
  description?: string
  fields?: SampleFieldSpec[]
  /** Relationship and select fields: the value is an array. */
  hasMany?: boolean
  label: string
  name: string
  options?: Array<{ label: string; value: string }>
  /**
   * For relationship fields: the collection(s) a value may point at. The admin renders Payload's own
   * `RelationshipInput`, which loads titles and paginates on its own, so no documents are sent here.
   */
  relationTo?: string[]
  required?: boolean
  type: 'array' | 'checkbox' | 'date' | 'email' | 'group' | 'json' | 'number' | 'radio' | 'relationship' | 'select' | 'text' | 'textarea'
}

// ---------------------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------------------

export type Attachment = NonNullable<SendEmailOptions['attachments']>[number]

export type SendArgs<S extends EmailSlug = EmailSlug> = {
  attachments?: Attachment[]
  bcc?: string | string[]
  cc?: string | string[]
  input: EmailInput<S>
  locale?: string
  /** Deliver through Payload Jobs instead of inline. Requires `queue.enabled`. */
  queue?: boolean | { queue?: string; waitUntil?: Date }
  replyTo?: string
  req?: PayloadRequest
  /** Overrides the definition's recipient logic. */
  to?: string | string[]
}

export type RenderArgs<S extends EmailSlug = EmailSlug> = {
  /** Render the latest draft instead of the published copy. */
  draft?: boolean
  input: EmailInput<S>
  locale?: string
  req?: PayloadRequest
}

export type RenderedEmail = {
  html: string
  preheader?: string
  subject: string
  text: string
  to?: string[]
  variables: Record<string, unknown>
}

export type SendStatus = 'failed' | 'queued' | 'sent' | 'skipped'

export type SendResult = {
  error?: string
  jobId?: number | string
  logId?: number | string
  messageId?: string
  reason?: string
  status: SendStatus
}

export type BeforeSendArgs = {
  definition: SanitizedEmailDefinition
  input: Record<string, unknown>
  message: SendEmailOptions
  payload: Payload
  variables: Record<string, unknown>
}

export type AfterSendArgs = {
  definition: SanitizedEmailDefinition
  error?: unknown
  message: SendEmailOptions
  payload: Payload
  result: SendResult
}

export type EmailsHooks = {
  afterSend?: Array<(args: AfterSendArgs) => MaybePromise<void>>
  beforeRender?: Array<
    (args: {
      definition: SanitizedEmailDefinition
      payload: Payload
      variables: Record<string, unknown>
    }) => MaybePromise<Record<string, unknown>>
  >
  beforeSend?: Array<(args: BeforeSendArgs) => MaybePromise<SendEmailOptions>>
  shouldSend?: Array<(args: ShouldSendArgs) => MaybePromise<boolean | { skip: string }>>
}

export interface EmailsAPI {
  definitions: ReadonlyMap<string, SanitizedEmailDefinition>
  /** Documents whose key is no longer defined in code. */
  orphans: () => Promise<Array<{ id: number | string; key: string }>>
  render: <S extends EmailSlug>(slug: S, args: RenderArgs<S>) => Promise<RenderedEmail>
  send: <S extends EmailSlug>(slug: S, args: SendArgs<S>) => Promise<SendResult>
  /** Seed missing documents, refresh code-owned fields, flag orphans. Runs on init. */
  sync: () => Promise<SyncResult>
}

export type SyncResult = {
  created: string[]
  orphaned: string[]
  refreshed: string[]
  renamed: Array<{ from: string; to: string }>
}

// ---------------------------------------------------------------------------------------------
// Plugin options
// ---------------------------------------------------------------------------------------------

export type EmailsPluginOptions = {
  access?: {
    delete?: Access
    read?: Access
    update?: Access
  }
  /** Slug of the emails collection. @default 'transactional-emails' */
  collectionSlug?: string
  dateFormat?: Intl.DateTimeFormatOptions
  /** Keep collections (for migrations) but skip runtime behaviour. */
  disabled?: boolean
  /** Editor for the body field. Defaults to the plugin's email-safe Lexical config. */
  editor?: RichTextAdapterProvider<any, any, any>
  emails: EmailDefinition<any>[]
  /** Variables available in every email, e.g. `site.name`. */
  globalVariables?: (args: {
    locale?: string
    payload: Payload
    settings: EmailSettings
  }) => MaybePromise<Record<string, unknown>>
  /** Chips and descriptions for the global variables. */
  globalVariableManifest?: VariableManifest
  hooks?: EmailsHooks
  templates?: Record<string, EmailTemplate>
  log?: {
    enabled: boolean
    includeTests?: boolean
    retentionDays?: number
    slug?: string
    storeHtml?: boolean
    storeVariables?: boolean
  }
  queue?: {
    /** Queue every send unless the call passes `queue: false`. */
    default?: boolean
    enabled: boolean
    queue?: string
    retries?: number
  }
  /** When to seed/refresh documents on init. @default 'always' */
  seed?: 'always' | 'development' | false
  settings?:
    | false
    | {
        adminRecipients?: string[]
        /** Upload collection for the brand logo. Text URL field is always available. */
        mediaCollection?: CollectionSlug
        slug?: string
      }
  /** Validate `input` against `inputSchema` on send. @default 'development' */
  validateInput?: 'always' | 'development' | 'never'
  versions?: boolean | { drafts: boolean }
}

export type SanitizedEmailsPluginOptions = {
  collectionSlug: string
  definitions: Map<string, SanitizedEmailDefinition>
  logSlug: string
  settingsSlug: string
  templates: Record<string, EmailTemplate>
  versions: { drafts: boolean } | false
} & Omit<EmailsPluginOptions, 'collectionSlug' | 'templates' | 'versions'>

/** Shape of a `transactional-emails` document as the plugin reads it. */
export type TransactionalEmailDoc = {
  audience?: EmailAudience
  body?: null | SerializedEditorState
  definitionHash?: string
  description?: string
  enabled?: boolean
  group?: string
  id: number | string
  inUse?: boolean
  key: string
  label?: string
  preheader?: null | string
  recipients?: {
    bcc?: Array<{ email: string }> | null
    cc?: Array<{ email: string }> | null
    replyTo?: null | string
    to?: Array<{ email: string }> | null
  } | null
  required?: boolean
  sampleInput?: null | Record<string, unknown>
  subject?: null | string
  trigger?: string
  variables?: null | VariableManifest
}
