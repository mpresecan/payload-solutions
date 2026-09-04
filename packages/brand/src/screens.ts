/**
 * Real screenshots of the Payload Stack template (templates/payload-stack), captured at
 * 1280x800 at 2x in both themes. Re-capture after UI changes; do not hand-edit.
 */
import adminOrgEditDark from '../assets/screens/admin-org-edit-dark.png'
import adminOrgEditLight from '../assets/screens/admin-org-edit-light.png'
import adminProjectsDark from '../assets/screens/admin-projects-dark.png'
import adminProjectsLight from '../assets/screens/admin-projects-light.png'
import dashboardDark from '../assets/screens/dashboard-dark.png'
import dashboardLight from '../assets/screens/dashboard-light.png'
import peopleDark from '../assets/screens/people-dark.png'
import peopleLight from '../assets/screens/people-light.png'
import pricingDark from '../assets/screens/pricing-dark.png'
import pricingLight from '../assets/screens/pricing-light.png'
import projectsDark from '../assets/screens/projects-dark.png'
import projectsLight from '../assets/screens/projects-light.png'
import signInDark from '../assets/screens/sign-in-dark.png'
import signInLight from '../assets/screens/sign-in-light.png'

export const screens = {
  /** Dashboard overview: projects count, organization, billing. */
  dashboard: {
    light: dashboardLight,
    dark: dashboardDark,
    alt: 'Payload Stack dashboard overview for the Ridgeline organization',
  },
  /** Projects table with the create form, scoped to the active organization. */
  projects: {
    light: projectsLight,
    dark: projectsDark,
    alt: 'Projects page in the Payload Stack dashboard: a table of four projects and a create form',
  },
  /** Organization people: members and invitations. */
  people: {
    light: peopleLight,
    dark: peopleDark,
    alt: 'Organization members and invitations in the Payload Stack dashboard',
  },
  /** Payload admin: projects collection list. */
  adminProjects: {
    light: adminProjectsLight,
    dark: adminProjectsDark,
    alt: 'The Payload admin panel listing the projects collection',
  },
  /** Payload admin: editing an organization document. */
  adminOrgEdit: {
    light: adminOrgEditLight,
    dark: adminOrgEditDark,
    alt: 'Editing the Ridgeline organization in the Payload admin panel',
  },
  /** Public pricing page generated from stack.config.ts. */
  pricing: {
    light: pricingLight,
    dark: pricingDark,
    alt: 'Pricing page with Starter and Team plans, generated from stack.config.ts',
  },
  /** Sign-in card with password, magic link and passkey. */
  signIn: {
    light: signInLight,
    dark: signInDark,
    alt: 'Sign-in screen with email and password, magic link and passkey options',
  },
} as const

export type ScreenName = keyof typeof screens
