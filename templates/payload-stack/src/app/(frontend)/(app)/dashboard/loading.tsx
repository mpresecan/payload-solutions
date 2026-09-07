import { Skeleton } from '@/components/ui/skeleton'

/** Shown while a dashboard route's data resolves, instead of a blank frame. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
