'use client'

import { generateOrganizationSlug } from '@better-auth-ui/core/plugins/organization'
import { ArrowRightIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { authClient } from '@/lib/auth/auth-client'
import { paths } from '@/lib/paths'
import stack from '@/stack.config'
import { completeOnboarding } from './actions'

/**
 * Step one of onboarding: create the first organization and make it active.
 * With billing attached to organizations, the user lands on the plan picker next; otherwise on the
 * dashboard.
 */
export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter()
  const [name, setName] = useState(suggestedName)
  const [slug, setSlug] = useState(generateOrganizationSlug(suggestedName))
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function onNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(generateOrganizationSlug(value))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    start(async () => {
      const created = await authClient.organization.create({ name: name.trim(), slug: slug.trim() })
      if (created.error) {
        setError(created.error.message ?? 'Could not create the organization')
        return
      }
      await authClient.organization.setActive({ organizationId: created.data.id })
      await completeOnboarding()
      toast.success(`${created.data.name} is ready`)
      router.push(stack.features.billingAttachedTo === 'organization' ? paths.dashboard.organizationBilling : paths.dashboard.home)
      router.refresh()
    })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your organization</CardTitle>
        <CardDescription>
          Your team&apos;s workspace in {stack.name}. You can invite people and rename it later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="org-name">Name</Label>
            <Input id="org-name" value={name} onChange={(e) => onNameChange(e.target.value)} required minLength={2} maxLength={60} autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="org-slug">URL slug</Label>
            <Input
              id="org-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
              required
              pattern="[a-z0-9\-]+"
              minLength={2}
              maxLength={60}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending || name.trim().length < 2}>
            {pending ? <Spinner /> : null}
            Continue
            {pending ? null : <ArrowRightIcon />}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
