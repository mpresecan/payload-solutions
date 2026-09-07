'use client'

import { useCategory, useConsent } from '@payload-solutions/consent-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/** Modal preferences: one switch per category, trackers listed under each. Draft until "Save". */
export function ConsentPreferencesDialog() {
  const { ready, state, config, acceptAll, rejectAll, save, close } = useConsent()
  if (!ready || !state || !config) return null
  const openDialog = state.ui === 'preferences'
  const { banner } = config

  return (
    <Dialog open={openDialog} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" data-consent-preferences="">
        <DialogHeader>
          <DialogTitle>{banner.title}</DialogTitle>
          <DialogDescription>{banner.description}</DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" className="w-full">
          {config.categories.map((category) => (
            <CategoryRow key={category.key} categoryKey={category.key} requiredLabel={banner.labels.requiredBadge} />
          ))}
        </Accordion>

        {state.needsReload ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground" role="status">
            {banner.labels.reloadNotice}{' '}
            <button type="button" className="underline underline-offset-4" onClick={() => window.location.reload()}>
              Reload
            </button>
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={rejectAll}>
              {banner.labels.rejectAll}
            </Button>
            <Button variant="outline" onClick={acceptAll}>
              {banner.labels.acceptAll}
            </Button>
          </div>
          <Button onClick={save}>{banner.labels.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryRow({ categoryKey, requiredLabel }: { categoryKey: string; requiredLabel: string }) {
  const { category, draft, required, toggle } = useCategory(categoryKey)
  const { config } = useConsent()
  if (!category) return null
  const trackers = config?.trackers.filter((t) => t.categoryKey === categoryKey) ?? []
  const switchId = `consent-${category.key}`

  return (
    <AccordionItem value={category.key}>
      <div className="flex items-center justify-between gap-4 py-1">
        <AccordionTrigger className="flex-1 py-2 text-left hover:no-underline">
          <span className="flex items-center gap-2">
            <span className="font-medium">{category.label}</span>
            {required ? <Badge variant="secondary">{requiredLabel}</Badge> : null}
          </span>
        </AccordionTrigger>
        <Label htmlFor={switchId} className="sr-only">
          {category.label}
        </Label>
        <Switch id={switchId} checked={required ? true : draft} disabled={required} onCheckedChange={(v) => toggle(Boolean(v))} aria-describedby={`${switchId}-desc`} />
      </div>
      <AccordionContent>
        <p id={`${switchId}-desc`} className="text-sm text-muted-foreground">
          {category.description}
        </p>
        {trackers.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {trackers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{t.name}</span>
                {t.vendor ? <span className="text-muted-foreground">{t.vendor}</span> : null}
                {t.purpose ? <span className="text-muted-foreground">— {t.purpose}</span> : null}
                {t.vendorPrivacyUrl ? (
                  <a className="underline underline-offset-4" href={t.vendorPrivacyUrl} target="_blank" rel="noopener noreferrer">
                    Privacy policy
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  )
}
