/** Fail the current attempt without retrying it. */
export class PermanentError extends Error {
  override name = 'PermanentError'
}

/** Complete the action without doing anything; `reason` becomes the stored note. */
export class SkipAction extends Error {
  override name = 'SkipAction'
  constructor(reason: string) {
    super(reason)
  }
}

export class ActionNotDefined extends Error {
  override name = 'ActionNotDefined'
  constructor(hook: string) {
    super(`Action "${hook}" is not registered. Add it to actionScheduler({ actions: [...] }).`)
  }
}

export class ActionArgsTooLarge extends Error {
  override name = 'ActionArgsTooLarge'
  constructor(hook: string, bytes: number, max: number) {
    super(
      `Arguments for "${hook}" are ${bytes} bytes; the limit is ${max}. Pass ids, not documents (maxArgsBytes).`,
    )
  }
}

export class ActionArgsInvalid extends Error {
  override name = 'ActionArgsInvalid'
  constructor(hook: string, detail: string) {
    super(`Arguments for "${hook}" are invalid: ${detail}`)
  }
}

export class SchedulerDisabled extends Error {
  override name = 'SchedulerDisabled'
  constructor() {
    super('The action scheduler is disabled (actionScheduler({ disabled: true })).')
  }
}

export class ActionTimeout extends Error {
  override name = 'ActionTimeout'
  constructor(ms: number) {
    super(`Timed out after ${Math.round(ms / 1000)} s`)
  }
}
