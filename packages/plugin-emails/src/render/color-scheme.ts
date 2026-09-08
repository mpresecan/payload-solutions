export type ColorScheme = 'dark' | 'light'

/**
 * A sandboxed frame inherits the viewer's own OS colour preference, and nothing in CSS can override
 * that for a child document. So pin both `prefers-color-scheme` queries to a constant truth value
 * before handing the HTML to the frame: the toggle decides which branch renders, not the machine
 * the admin happens to be open on.
 */
export function forceColorScheme(html: string, scheme: ColorScheme): string {
  if (!html) {
    return html
  }
  const isDark = scheme === 'dark'
  return html
    .replace(/\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi, isDark ? '(min-width:0px)' : '(max-width:0px)')
    .replace(/\(\s*prefers-color-scheme\s*:\s*light\s*\)/gi, isDark ? '(max-width:0px)' : '(min-width:0px)')
}
