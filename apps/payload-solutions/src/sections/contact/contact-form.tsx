'use client'

import { CheckCircle } from '@phosphor-icons/react'
import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { submitContact, type ContactState } from './actions'

const TOPICS = [
  { value: 'saas', label: 'Build a SaaS on Payload' },
  { value: 'stack', label: 'Payload Stack support' },
  { value: 'plugin', label: 'Plugin or integration' },
  { value: 'other', label: 'Something else' },
]

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { ok: false })

  if (state.ok) {
    return (
      <div className="flex h-full flex-col justify-center border border-border bg-surface p-8" role="status">
        <CheckCircle size={28} className="text-accent" aria-hidden />
        <h3 className="mt-4 text-xl font-medium tracking-tight">Thanks, we have it.</h3>
        <p className="mt-2 text-fg-muted">We reply within two working days, usually sooner.</p>
      </div>
    )
  }

  return (
    <form action={action} className="grid gap-5 border border-border bg-surface p-6 sm:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" id="name" error={state.field === 'name' ? state.error : undefined}>
          <input id="name" name="name" required minLength={2} autoComplete="name" className="field" />
        </Field>
        <Field label="Email" id="email" error={state.field === 'email' ? state.error : undefined}>
          <input id="email" name="email" type="email" required autoComplete="email" className="field" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Company" id="company" optional>
          <input id="company" name="company" autoComplete="organization" className="field" />
        </Field>
        <Field label="Topic" id="topic">
          <select id="topic" name="topic" defaultValue="saas" className="field">
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="What are you building?" id="message" error={state.field === 'message' ? state.error : undefined}>
        <textarea id="message" name="message" required minLength={20} rows={5} className="field" placeholder="The product, where it stands today, and what you need from us." />
      </Field>
      <Field label="Budget" id="budget" optional hint="A range is enough. It helps us propose the right scope.">
        <input id="budget" name="budget" className="field" placeholder="e.g. 15k to 30k EUR" />
      </Field>
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.error && !state.field ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-fg-subtle">Stored in our Payload admin. Never shared.</p>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? 'Sending' : 'Start a project'}
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
  hint,
}: {
  label: string
  id: string
  children: React.ReactNode
  error?: string
  optional?: boolean
  hint?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? <span className="ml-2 font-normal text-fg-subtle">optional</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
