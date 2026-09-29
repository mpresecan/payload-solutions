# Cookies and the ePrivacy rules

Two regimes apply at once, and conflating them is the usual mistake.

**ePrivacy Directive Art. 5(3)** governs *storing information on, or reading information from, a
device*. It applies whatever the information is — a cookie, a localStorage entry, a device
fingerprint, a pixel. Consent is required unless the access is strictly necessary to provide a
service the user explicitly requested, or is solely for carrying out a transmission.

**The GDPR** governs what is then done with any personal data involved: purposes, bases,
retention, disclosure.

So a page can satisfy the GDPR and still breach ePrivacy, and analytics is the standard example:
you may have a fine legitimate-interests story for processing the data, and still need consent
to write the cookie in the first place.

## "Strictly necessary" is narrow

It covers: session and authentication cookies, a load-balancing cookie, a security token, the
cart on a shop, a cookie remembering the visitor's consent choices, and UI state the user
explicitly asked for such as a language toggle.

It does not cover analytics — including self-hosted and "privacy-friendly" analytics — A/B
testing, personalisation, any advertising or measurement pixel, or session recording. Some
authorities exempt narrowly-scoped first-party audience measurement under conditions; that is a
national exemption to check, not a default to assume.

A category called "necessary" that contains an analytics tracker is a `contradiction/page-vs-registry`
finding, and a blocker: the banner is telling visitors something the configuration contradicts.

## What the cookie policy must do

- Say what is stored and read, per category, and why.
- List the individual cookies with their durations. Generate the table from the trackers with
  `{{cookie-table}}` rather than typing it — a typed table is out of date by the second sprint.
- Attribute third-party cookies to the vendor that sets them, with a link to their policy.
- Say how to change or withdraw a decision, and make that route real — a link that reopens the
  preferences dialog, not "adjust your browser settings", which is not withdrawal.
- Link to the privacy policy for the wider picture.

## Consent quality (EDPB Guidelines 05/2020)

Findings here are usually about the banner rather than the page, but they belong in the report.

- **Refusing must be as easy as accepting.** Accept and Reject at the same level, same
  prominence. A "Reject" hidden one click deeper is the single most common enforcement target.
- **No pre-ticked boxes**, and nothing non-essential loading before a decision.
- **Continued browsing is not consent.** Neither is scrolling.
- **Granular**, per purpose, not one switch for everything.
- **Withdrawable** as easily as it was given.
- **Cookie walls** are contested and jurisdiction-dependent; flag rather than bless.
- **Consent has a shelf life.** CNIL recommends re-asking after 6 months; several authorities
  accept 12–13. The plugin's `expiresAfterMonths` setting is what enforces it.

## Google Consent Mode

Consent Mode v2 signals are derived from the categories, not a substitute for consent. The tags
load with denied defaults and update on a decision. A policy that describes Consent Mode as
though it removed the need for a banner is wrong, and worth a finding.

## The plugin's own guarantees

Some things you do not need to check because the plugin enforces them: the cookie table is
generated from the trackers, "reject all" is forced on for opt-in visitors, and nothing
non-essential loads before a decision. Check the *prose* instead — whether the policy describes
that behaviour accurately.
