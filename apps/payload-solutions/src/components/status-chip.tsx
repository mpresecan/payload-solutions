import { cn } from '@/lib/cn'

const LABELS: Record<string, string> = {
  available: 'Available',
  'in-progress': 'In progress',
  planned: 'Planned',
  shipped: 'Shipped',
  exploring: 'Exploring',
}

/** Small mono status label. Accent only for things you can use today. */
export function StatusChip({ status, className }: { status: string; className?: string }) {
  const live = status === 'available' || status === 'shipped'
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.14em]',
        live ? 'border-accent text-accent' : 'border-border text-fg-muted',
        className,
      )}
    >
      {LABELS[status] ?? status}
    </span>
  )
}
