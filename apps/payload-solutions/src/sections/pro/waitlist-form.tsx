'use client'

import { CheckCircle } from '@phosphor-icons/react'
import { Email } from '@payload-solutions/brand/email'
import posthog from 'posthog-js'
import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { PRO_STAGES, PRO_VERTICALS } from '@/lib/pro'
import { joinProWaitlist, type WaitlistState } from './actions'

/**
 * The Pro waitlist form. Only the email and the consent box are required; the vertical vote is
 * the part we learn from, so it sits second and is phrased as a vote rather than a survey.
 * `id` lets the page render it twice (hero and closer) without clashing input ids.
 */
export function WaitlistForm({ id = 'waitlist', source = 'pro' }: { id?: string; source?: string }) {
  const submit = async (previous: WaitlistState, formData: FormData) => {
    const next = await joinProWaitlist(previous, formData)
    if (next.ok && process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
      posthog.capture('pro_waitlist_joined', {
        source,
        verticals: formData.getAll('verticals').map(String),
        stage: formData.get('stage') || undefined,
        returning: next.returning,
      })
    }
    return next
  }
  const [state, action, pending] = useActionState<WaitlistState, FormData>(submit, { ok: false })
  const f = (name: string) => `${id}-${name}`

  if (state.ok) {
    return (
      <div className="flex h-full flex-col justify-center border border-border bg-surface p-8" role="status">
        <CheckCircle size={28} className="text-accent" aria-hidden />
        <h3 className="mt-4 text-xl font-medium tracking-tight">
          {state.returning ? 'Updated. You were already on the list.' : "You're on the list."}
        </h3>
        <p className="mt-2 max-w-[42ch] text-pretty text-fg-muted">
          {state.returning
            ? 'We saved your new vote. You will hear from us when the first vertical is ready.'
            : 'Check your inbox for a confirmation. You will hear from us when the first vertical is ready, before anyone else.'}
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="grid gap-6 border border-border bg-surface p-6 sm:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" id={f('email')} error={state.field === 'email' ? state.error : undefined}>
          <input id={f('email')} name="email" type="email" required autoComplete="email" className="field" />
        </Field>
        <Field label="Name" id={f('name')} optional>
          <input id={f('name')} name="name" autoComplete="given-name" className="field" />
        </Field>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">
          Which vertical should we build first?
          <span className="ml-2 font-normal text-fg-subtle">pick any</span>
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PRO_VERTICALS.map((v) => (
            <label
              key={v.value}
              className="flex cursor-pointer items-center gap-3 border border-border px-3 py-2.5 text-sm transition-colors hover:border-border-strong has-[:checked]:border-accent has-[:checked]:text-fg"
            >
              <input type="checkbox" name="verticals" value={v.value} className="size-4 shrink-0 accent-accent" />
              {v.label}
            </label>
          ))}
        </div>
        <input
          name="otherVertical"
          aria-label="Another vertical"
          placeholder="Something else? Tell us what"
          className="field"
          maxLength={160}
        />
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Where are you?" id={f('stage')} optional>
          <select id={f('stage')} name="stage" defaultValue="" className="field">
            <option value="">Choose one</option>
            {PRO_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What are you building?" id={f('building')} optional>
          <input id={f('building')} name="building" className="field" placeholder="One line is plenty" maxLength={2000} />
        </Field>
      </div>

      <input type="hidden" name="source" value={source} />
      <div className="hidden" aria-hidden>
        <label htmlFor={f('website')}>Website</label>
        <input id={f('website')} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error && !state.field ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <label htmlFor={f('privacy')} className="flex items-start gap-3 text-sm text-fg-muted">
          <input
            id={f('privacy')}
            name="privacy"
            type="checkbox"
            required
            aria-describedby={state.field === 'privacy' ? f('privacy-error') : undefined}
            className="mt-0.5 size-4 shrink-0 accent-accent"
          />
          <span>
            Email me about Payload Stack Pro. Fortbit d.o.o. keeps my answers to plan and announce
            it, as described in the{' '}
            <a href="/legal/privacy" target="_blank" rel="noopener" className="text-fg underline underline-offset-4">
              privacy policy
            </a>
            . I can leave the list at any time by writing to <Email address="privacy@payload.solutions" />.
          </span>
        </label>
        {state.field === 'privacy' ? (
          <p id={f('privacy-error')} role="alert" className="text-xs text-danger">
            {state.error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-fg-subtle">No spam. One email when Pro opens.</p>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? 'Joining' : 'Join the waitlist'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  id,
  children,
  error,
  optional,
}: {
  label: string
  id: string
  children: React.ReactNode
  error?: string
  optional?: boolean
}) {
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? <span className="ml-2 font-normal text-fg-subtle">optional</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
