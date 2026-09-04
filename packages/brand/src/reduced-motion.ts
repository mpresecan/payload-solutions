'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const getSnapshot = () => window.matchMedia(QUERY).matches
const getServerSnapshot = () => false

/**
 * `prefers-reduced-motion`, hydration-safe. Motion's own `useReducedMotion` reads the media
 * query during the first client render, so markup that depends on it differs from the server
 * HTML and React reports a mismatch. This returns `false` on the server and during hydration,
 * then the real value, so the first paint matches and motion is removed one frame later.
 */
export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
