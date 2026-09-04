'use client'

import { IsoStack, type IsoLayer } from '@payload-solutions/brand/iso-stack'

const LAYERS: IsoLayer[] = [
  { id: 'payload', name: 'Payload CMS', detail: 'The backend we build everything on' },
  { id: 'stack', name: 'Payload Stack', detail: 'SaaS boilerplate, one command' },
  { id: 'clock', name: 'Payload Clock', detail: 'Scheduler for serverless job queues' },
  {
    id: 'plugins',
    name: 'Plugins',
    detail: 'Built for every Payload project',
    cycle: ['Payload Emails', 'Vercel Integration', 'Action Scheduler', 'Clock plugin'],
    accent: true,
  },
]

/** The product family, stacked on Payload CMS. The plugin layer cycles through what is planned. */
export function FamilyVisual({ className }: { className?: string }) {
  return (
    <IsoStack
      className={className}
      layers={LAYERS}
      caption="The Payload Solutions family: Payload CMS at the base, then Payload Stack, Payload Clock and a growing set of plugins (Payload Emails, Vercel Integration, Action Scheduler, the Clock plugin)."
    />
  )
}
