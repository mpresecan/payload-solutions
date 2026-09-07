import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shown while the dashboard home resolves its session, organization and project count.
 *
 * This lives in the (overview) route group, not at dashboard/, on purpose. A loading.tsx wraps
 * every segment below it in Suspense, and Next.js flushes that shell with a 200 before the page
 * runs — so a `notFound()` in settings/[path], organization/[path] or admin/[path] could no longer
 * set the status, and unknown tabs answered 200 instead of 404 (tests/e2e/marketing.e2e.spec.ts).
 * Keep skeletons on the segments that actually fetch: here and projects/.
 */
export default function OverviewLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-32" />
    </div>
  )
}
