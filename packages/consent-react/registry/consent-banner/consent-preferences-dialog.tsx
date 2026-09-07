'use client'

import { useCategory, useConsent } from '@payload-solutions/consent-react'
import { ChevronDown, Cookie } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/**
 * Preferences: one card per category with its switch, the services inside it one click away.
 * Changes are a draft until "Save", so nothing is recorded while the visitor is still deciding.
 */
export function ConsentPreferencesDialog() {
  const { ready, state, config, acceptAll, rejectAll, save, close, open } = useConsent()
  if (!ready || !state || !config) return null
  const { banner } = config
  // Closing without deciding goes back to the banner rather than leaving the visitor with nothing.
  const dismissDialog = () => (state.status === 'undecided' ? open('banner') : close())

  return (
    <Dialog onOpenChange={(next) => (next ? undefined : dismissDialog())} open={state.ui === 'preferences'}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg" data-consent-preferences="" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3 text-left">
          <div className="space-y-1">
            <DialogTitle className="text-base font-medium sm:text-lg">{banner.title}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{banner.description}</DialogDescription>
          </div>
          <Cookie aria-hidden className="size-4 shrink-0 text-muted-foreground sm:size-5" />
        </DialogHeader>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto p-4">
          {config.categories.map((category) => (
            <CategoryCard categoryKey={category.key} key={category.key} requiredLabel={banner.labels.requiredBadge} />
          ))}

          {state.needsReload ? (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground sm:text-sm" role="status">
              {banner.labels.reloadNotice}{' '}
              <button className="underline underline-offset-4" onClick={() => window.location.reload()} type="button">
                Reload
              </button>
            </p>
          ) : null}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 border-t p-4 dark:bg-background/20 sm:flex sm:justify-between">
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex">
            <Button onClick={rejectAll} size="sm" variant="ghost">
              {banner.labels.rejectAll}
            </Button>
            <Button onClick={acceptAll} size="sm" variant="ghost">
              {banner.labels.acceptAll}
            </Button>
          </div>
          <Button className="col-span-2 w-full sm:w-auto" onClick={save}>
            {banner.labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryCard({ categoryKey, requiredLabel }: { categoryKey: string; requiredLabel: string }) {
  const { category, draft, required, toggle } = useCategory(categoryKey)
  const { config } = useConsent()
  const [expanded, setExpanded] = useState(false)
  if (!category) return null

  const trackers = config?.trackers.filter((t) => t.categoryKey === categoryKey) ?? []
  const switchId = `consent-${category.key}`

  return (
    <div className="rounded-md border" data-consent-category={category.key}>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium" htmlFor={switchId}>
              {category.label}
            </Label>
            {required ? (
              <Badge className="text-[10px] font-normal" variant="secondary">
                {requiredLabel}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground" id={`${switchId}-desc`}>
            {category.description}
          </p>
        </div>
        <Switch
          aria-describedby={`${switchId}-desc`}
          checked={required ? true : draft}
          disabled={required}
          id={switchId}
          onCheckedChange={(v) => toggle(Boolean(v))}
        />
      </div>

      {trackers.length > 0 ? (
        <div className="border-t">
          <button
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
            type="button"
          >
            {trackers.length} {trackers.length === 1 ? 'service' : 'services'}
            <ChevronDown aria-hidden className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
          {expanded ? (
            <ul className="space-y-2 px-3 pb-3 text-xs">
              {trackers.map((t) => (
                <li key={t.id}>
                  <span className="font-medium">{t.name}</span>
                  {t.vendor ? <span className="text-muted-foreground"> · {t.vendor}</span> : null}
                  {t.purpose ? <p className="text-muted-foreground">{t.purpose}</p> : null}
                  {t.vendorPrivacyUrl ? (
                    <a
                      className="underline underline-offset-4 hover:text-foreground"
                      href={t.vendorPrivacyUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Privacy policy
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
