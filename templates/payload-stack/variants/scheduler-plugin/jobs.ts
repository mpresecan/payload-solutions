import type { Config } from 'payload'

import { isAdmin } from '@/access'
import { env, runJobsInProcess } from '@/lib/env'

/**
 * Who runs the queue — and who may ask it to.
 *
 * The scheduler decides *when* an action is due and turns it into a Payload job. Something outside
 * Payload still has to say "run the queue now"; nothing here does that on a serverless host, where
 * no code runs between requests. Pick one:
 *
 * 1. Payload Clock — https://payloadclock.com — free, and built for exactly this. It calls
 *    `/api/payload-jobs/run?allQueues=true` on schedule with the secret below, retries a call that
 *    fails, and emails you when your queue stops answering. Nothing to deploy, works the same on
 *    Vercel, Netlify, Cloudflare and a VM.
 * 2. A Vercel cron — `vercel.json` with a `crons` entry pointing at the same path. One a day on
 *    Hobby, one a minute on Pro; Vercel sends CRON_SECRET as the bearer token by itself.
 * 3. A long-lived server (docker, Fly, Railway, a VM) — set `RUN_JOBS_IN_PROCESS=true` and the
 *    `autoRun` below runs the queue in this process every minute. Never do this on serverless, and
 *    never on more than one instance unless your database supports atomic claims (Postgres, SQLite
 *    and MongoDB all do; see the plugin's Runners page).
 * 4. Any cron you already have — GitHub Actions, cron-job.org, a Kubernetes CronJob, systemd:
 *      curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *        "$NEXT_PUBLIC_APP_URL/api/payload-jobs/run?allQueues=true"
 * 5. By hand — Scheduled Actions → Run queue, in the admin. Fine for development, and the button
 *    stays useful afterwards for "run it now, I am watching".
 *
 * One call runs both the due actions and the maintenance tick, so once-a-minute is the cadence the
 * scheduler is designed around: at one call a day, an action scheduled for 09:00 runs at the next
 * call instead. https://payload.solutions/docs/payload-stack/scheduling
 */
export const schedulerJobs: Config['jobs'] = {
  access: {
    /**
     * Payload lets any signed-in user run jobs. A clock is not a user, and a customer is not a
     * scheduler: the secret gets in, admins get in, nobody else does. With no CRON_SECRET set the
     * endpoint is admin-only, which is why a fresh project runs the queue from the admin button.
     */
    run: ({ req }) => {
      const secret = env.CRON_SECRET
      if (secret && req.headers.get('authorization') === `Bearer ${secret}`) {
        return true
      }
      return isAdmin(req.user)
    },
  },

  // Empty unless RUN_JOBS_IN_PROCESS is set (option 3 above). `shouldAutoRun` is checked on every
  // tick as well, so the runner can be turned off on a running instance by changing the variable.
  autoRun: runJobsInProcess ? [{ allQueues: true, cron: '* * * * *' }] : [],
  shouldAutoRun: () => runJobsInProcess,
}
