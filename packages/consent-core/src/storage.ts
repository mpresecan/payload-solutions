import type { StorageAdapter } from './types.js'

const hasDocument = () => typeof document !== 'undefined'

/** Default browser storage: a first-party cookie, mirrored to localStorage for cross-tab change events. */
export function cookieStorage(): StorageAdapter {
  return {
    read() {
      if (!hasDocument()) return null
      for (const part of document.cookie.split(';')) {
        const [k, ...rest] = part.trim().split('=')
        if (k && k === currentName) return decodeURIComponent(rest.join('='))
      }
      return null
    },
    write(value, { maxAgeDays, domain, sameSite, name }) {
      currentName = name
      if (!hasDocument()) return
      const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
      const dom = domain ? `; Domain=${domain}` : ''
      document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.round(maxAgeDays * 86400)}; SameSite=${sameSite === 'strict' ? 'Strict' : 'Lax'}${secure}${dom}`
      try {
        localStorage.setItem(`${name}:sync`, String(Date.now()))
      } catch {
        /* storage may be unavailable; cookie alone is fine */
      }
    },
    clear({ domain, name }) {
      currentName = name
      if (!hasDocument()) return
      const dom = domain ? `; Domain=${domain}` : ''
      document.cookie = `${name}=; Path=/; Max-Age=0${dom}`
      try {
        localStorage.setItem(`${name}:sync`, String(Date.now()))
      } catch {
        /* ignore */
      }
    },
  }
}

// The cookie name is only known at write time; reads before the first write fall back to this.
let currentName = 'pl-consent'
export function setCookieStorageName(name: string) {
  currentName = name
}

/** In-memory storage for tests and server-side rendering. */
export function memoryStorage(initial: string | null = null): StorageAdapter & { value: string | null } {
  const box = {
    value: initial,
    read: () => box.value,
    write(value: string) {
      box.value = value
    },
    clear() {
      box.value = null
    },
  }
  return box
}
