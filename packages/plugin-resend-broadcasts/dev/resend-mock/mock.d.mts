export type ResendMock = {
  deliverWebhook: (type: string, contact: Record<string, unknown>) => Promise<boolean>
  handleRequest: (request: Request, prefix?: string) => Promise<Response>
  listen: (port?: number) => Promise<{ close: () => Promise<void>; url: string }>
  reset: () => void
  state: {
    broadcasts: Map<string, Record<string, any>>
    contacts: Map<string, Record<string, any>>
    emails: Array<Record<string, any>>
    properties: Map<string, Record<string, any>>
    requests: Array<{ body: any; method: string; path: string }>
    segments: Map<string, { created_at: string; id: string; members: Set<string>; name: string }>
  }
}
export function createResendMock(options?: {
  webhookSecret?: string
  webhookUrl?: string
}): ResendMock
export function signWebhook(
  secret: string,
  body: string,
  options?: { id?: string; timestamp?: number },
): Record<'svix-id' | 'svix-signature' | 'svix-timestamp', string>
