---
name: stack-email
description: Use when adding, changing or sending a transactional email in this Payload Stack project (welcome, notices, reminders, anything in src/emails), or when code needs to send a message.
---

# Add or send a transactional email

A project is scaffolded in one of two email branches. Check which one before writing anything:

```bash
ls src/emails/definitions 2>/dev/null && echo "Transactional Emails (copy in the admin)" || echo "React Email in code"
```

Either way, `src/emails/index.ts` exports `emails` with the same function signatures, and Better
Auth (`src/lib/auth/options.ts`) and payload-auth call only those. Keep the signatures; change what
is behind them.

## Branch A: React Email in code (no `src/emails/definitions`)

- Templates are React components in `src/components/auth/email/*` (from Better Auth UI). Add a new
  one next to them; preview with `pnpm email:dev`.
- Add a function to the `emails` object in `src/emails/index.ts`:

  ```ts
  trialEnding: (payload: Payload, to: string, args: { planName: string; endsAt: string }) =>
    sendEmail(payload, {
      to,
      subject: `Your ${name} trial ends soon`,
      react: createElement(TrialEndingEmail, { ...emailDefaults, email: to, ...args }),
    }),
  ```

- `sendEmail` (`src/emails/send.ts`) renders HTML and plain text and hands both to
  `payload.sendEmail`. Do not call Resend directly: going through Payload is what lets the adapter
  change (console in development, Resend in production) without touching call sites.
- `src/emails/hooks.ts` is the no-op half of a seam here: `emailsEnabled` is `false` and `notify`
  does nothing. Do not put real sending in it; that file is replaced when Transactional Emails is added.

## Branch B: Transactional Emails (`src/emails/definitions` exists)

Subject, preheader and body live in the Payload admin under **Emails**; the design is
`src/emails/template.tsx`; each message is a definition.

1. Write a `defineEmail({...})` in the matching file under `src/emails/definitions/`
   (`account.ts`, `auth.ts`, `billing.ts`, `organization.ts`). Copy the shape of `welcome` in
   `account.ts`:
   - `slug` (stable: documents in the admin refer to it), `label`, `description`, `trigger` (where
     it fires, in words), `group`, `audience`
   - `inputSchema`: Payload fields for what the caller passes
   - `variables`: every `{{placeholder}}` the copy may use, each with an `example`
   - `resolve`: turns `input` into those variables (use `populate` with `{ req }` for relations)
   - `to`, `defaults` (`subject`, `preheader`, `body` in Markdown with `<Button ... />`), `sample`
     (for the preview tab)
   An email that only exists with organizations goes in `organization.ts` and uses that file's
   `defineOrganizationEmail` instead of `defineEmail`: with organizations off, its slug and the
   organization collections drop out of the generated types, and a typed `defineEmail` would stop
   compiling.
2. Add it to `emailDefinitions` in `src/emails/definitions/index.ts`, gated on `stack.features.*`
   if the feature may be off. A definition not in that array is not in the admin and never sent.
3. `pnpm generate:types` so `payload.emails.send('<slug>', { input })` is type-checked.
4. Send it:
   - from the `emails` object, if Better Auth or payload-auth triggers it;
   - otherwise through `notify(payload, '<slug>', input, { to })` from `src/emails/hooks.ts`.
     `notify` throws on failure (on purpose: a scheduled action should be retried), so wrap it
     where a failed email must not fail the request.

## Sending from feature code

Code outside `src/emails` imports from `@/emails/hooks` (`emailsEnabled`, `notify`) or
`@/emails` (`emails.*`), never from `@payload-solutions/plugin-emails`. The plugin may not be
installed in this project, and the seam keeps the code compiling either way. Check `emailsEnabled`
before offering a feature that depends on a message being sent.

To send later (a nudge in three days) use the `emails.send` scheduled action; see the
`stack-scheduled-action` skill.

## Tests

- Branch A: `tests/unit/emails.spec.ts` (`sendEmail pipeline`, `templates`).
- Branch B: `tests/unit/emails.spec.ts` checks the catalogue under each preset, the copy's
  variables and the recipients. Add the new slug to the catalogue expectations for the presets
  that should have it.
- An integration test can use `captureEmails` from `tests/helpers/int.ts` to assert a message was
  sent.

Finish with `pnpm verify`.
