import type { Severity } from './types.js'

/**
 * What each legal document has to contain, as data.
 *
 * The scan cannot answer these — they are questions about prose — so the agent walks them and
 * answers each with a quote from the page. Keeping them here rather than in the skill's prose
 * means the checklist the agent works from and the checklist the plugin ships are the same
 * object, and a requirement can be cited by id in a finding.
 */
export type Requirement = {
  id: string
  cite: string
  title: string
  /** The question the agent must answer from the page text. */
  question: string
  severity: Severity
  /** Finding code to raise when the answer is no. */
  code: string
  /** Only applies when the compliance profile says so. */
  appliesWhen?: { audience?: string[]; role?: string[]; automatedDecisions?: string[]; offersToEEA?: boolean }
  /** Profile keys whose answers this requirement depends on. */
  needsInput?: string[]
}

export type Checklist = {
  kind: string
  label: string
  intro: string
  requirements: Requirement[]
}

const privacy: Checklist = {
  kind: 'privacy',
  label: 'Privacy policy',
  intro:
    'Articles 13 and 14 list what a data subject must be told. Each item below is mandatory unless its condition says otherwise; “we take your privacy seriously” satisfies none of them.',
  requirements: [
    { id: 'controller-identity', cite: 'Art. 13(1)(a)', title: 'Controller identity and contact details', question: 'Does the page name the controlling legal entity and give a postal address and contact route?', severity: 'blocker', code: 'art13/missing-disclosure', needsInput: ['legalName', 'address', 'contactEmail'] },
    { id: 'dpo', cite: 'Art. 13(1)(b)', title: 'Data Protection Officer', question: 'If a DPO is appointed, are their contact details given?', severity: 'blocker', code: 'art13/missing-disclosure', needsInput: ['dpo'] },
    { id: 'purposes', cite: 'Art. 13(1)(c)', title: 'Purposes of processing', question: 'Is each purpose stated specifically enough that a reader knows what happens to their data?', severity: 'blocker', code: 'art13/missing-disclosure' },
    { id: 'legal-basis', cite: 'Art. 13(1)(c)', title: 'Legal basis per purpose', question: 'Is a legal basis given for every purpose, not just for the page as a whole?', severity: 'blocker', code: 'art13/missing-disclosure', needsInput: ['legalBases'] },
    { id: 'legitimate-interests', cite: 'Art. 13(1)(d)', title: 'The legitimate interests relied on', question: 'Where legitimate interests are the basis, does the page say what those interests are?', severity: 'blocker', code: 'art13/missing-disclosure' },
    { id: 'recipients', cite: 'Art. 13(1)(e)', title: 'Recipients or categories of recipient', question: 'Does the page disclose who receives the data — ideally the live recipients table rather than prose that drifts?', severity: 'blocker', code: 'art13/missing-disclosure' },
    { id: 'transfers', cite: 'Art. 13(1)(f)', title: 'International transfers and safeguards', question: 'Where data leaves the EEA, does the page name the mechanism (adequacy, DPF, SCCs) and say how to obtain a copy of the safeguards?', severity: 'blocker', code: 'art13/missing-disclosure', appliesWhen: { offersToEEA: true } },
    { id: 'retention', cite: 'Art. 13(2)(a)', title: 'Retention period or criteria', question: 'Is a period or the criteria for determining it given? “As long as necessary” alone does not qualify.', severity: 'blocker', code: 'art13/missing-disclosure', needsInput: ['retention'] },
    { id: 'rights', cite: 'Art. 13(2)(b)', title: 'Data subject rights', question: 'Are access, rectification, erasure, restriction, objection and portability all listed, with a route to exercise them?', severity: 'blocker', code: 'art13/missing-disclosure', needsInput: ['dsrEmail'] },
    { id: 'withdrawal', cite: 'Art. 13(2)(c)', title: 'Right to withdraw consent', question: 'Where consent is a basis, does the page say consent can be withdrawn at any time without affecting prior processing?', severity: 'blocker', code: 'art13/missing-disclosure' },
    { id: 'complaint', cite: 'Art. 13(2)(d)', title: 'Right to complain to a supervisory authority', question: 'Is the right to lodge a complaint stated, with the authority identified?', severity: 'blocker', code: 'art13/missing-disclosure', needsInput: ['supervisoryAuthority'] },
    { id: 'statutory', cite: 'Art. 13(2)(e)', title: 'Whether providing data is required', question: 'Does the page say which data is necessary to enter a contract and what happens if it is not provided?', severity: 'warn', code: 'art13/missing-disclosure' },
    { id: 'automated', cite: 'Art. 13(2)(f)', title: 'Automated decision-making', question: 'Is automated decision-making or profiling either explained (logic, significance, consequences) or absent from the page because it does not happen?', severity: 'warn', code: 'art13/missing-disclosure', needsInput: ['automatedDecisions'] },
    { id: 'indirect', cite: 'Art. 14(2)(f)', title: 'Data obtained from third parties', question: 'If any personal data is not collected from the person, does the page name the source?', severity: 'warn', code: 'art13/missing-disclosure' },
    { id: 'plain-language', cite: 'Art. 12(1)', title: 'Concise, intelligible, plain language', question: 'Could a non-lawyer follow this page, or is it padded with defensive boilerplate?', severity: 'info', code: 'clarity/plain-language' },
  ],
}

const cookies: Checklist = {
  kind: 'cookies',
  label: 'Cookie policy',
  intro:
    'The ePrivacy Directive governs storage and access on a device; the GDPR governs what is done with what is read. The cookie table should be generated from the trackers, never typed out.',
  requirements: [
    { id: 'what-and-why', cite: 'ePrivacy Art. 5(3)', title: 'What is stored and why', question: 'Does the page explain, per category, what is stored on the device and for what purpose?', severity: 'blocker', code: 'eprivacy/missing-disclosure' },
    { id: 'live-table', cite: 'Art. 13(1)(e)', title: 'A generated cookie table', question: 'Is the table rendered from the tracker configuration ({{cookie-table}}) rather than written out by hand?', severity: 'warn', code: 'eprivacy/missing-disclosure' },
    { id: 'durations', cite: 'EDPB 05/2020', title: 'Durations', question: 'Does each cookie have a stated lifetime?', severity: 'warn', code: 'eprivacy/missing-disclosure' },
    { id: 'third-parties', cite: 'Art. 13(1)(e)', title: 'Third parties', question: 'Are third-party cookies attributed to the vendor that sets them, with a link to their policy?', severity: 'warn', code: 'eprivacy/missing-disclosure' },
    { id: 'withdraw', cite: 'Art. 7(3)', title: 'How to change or withdraw', question: 'Does the page tell the reader how to reopen the preferences and change their mind?', severity: 'blocker', code: 'eprivacy/missing-disclosure' },
    { id: 'essential-scope', cite: 'ePrivacy Art. 5(3)', title: 'Honest “strictly necessary” scope', question: 'Is anything claimed as strictly necessary that is really analytics or marketing?', severity: 'blocker', code: 'contradiction/page-vs-registry' },
    { id: 'link-privacy', cite: 'Art. 12(1)', title: 'Link to the privacy policy', question: 'Does it point to the privacy policy for the wider picture?', severity: 'info', code: 'eprivacy/missing-disclosure' },
  ],
}

const subprocessors: Checklist = {
  kind: 'subprocessors',
  label: 'Sub-processor list',
  intro: 'This page is a contractual promise to your own customers. Art. 28(2) gives them the right to object to a change.',
  requirements: [
    { id: 'list', cite: 'Art. 28(2)', title: 'The current list', question: 'Is every active sub-processor listed with its purpose and processing location?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'notice', cite: 'Art. 28(2)', title: 'Advance notice period', question: 'Does the page state how much notice customers get before a new sub-processor starts?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'objection', cite: 'Art. 28(2)', title: 'How to object', question: 'Is there a route to object, and does it say what happens if a customer does?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'changes', cite: 'Art. 28(2)', title: 'Change history', question: 'Can a customer see what changed and when?', severity: 'warn', code: 'art28/missing-clause' },
  ],
}

const dpa: Checklist = {
  kind: 'dpa',
  label: 'Data processing agreement',
  intro:
    'Art. 28(3) lists eight clauses a processing contract must contain. They are cumulative: a DPA missing one of them is not a DPA.',
  requirements: [
    { id: 'documented-instructions', cite: 'Art. 28(3)(a)', title: 'Processing only on documented instructions', question: 'Does the DPA bind the processor to act only on the controller’s documented instructions, including for transfers?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'confidentiality', cite: 'Art. 28(3)(b)', title: 'Confidentiality of personnel', question: 'Are persons authorised to process bound by confidentiality?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'security', cite: 'Art. 28(3)(c), Art. 32', title: 'Security measures', question: 'Are the Art. 32 measures committed to, and described somewhere concrete (usually Annex II)?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'subprocessors', cite: 'Art. 28(3)(d), 28(2), 28(4)', title: 'Sub-processor conditions', question: 'Are authorisation, notice and flow-down of the same obligations all covered?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'data-subject-rights', cite: 'Art. 28(3)(e)', title: 'Assistance with data subject rights', question: 'Does the processor commit to assist with requests, taking account of the nature of processing?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'assistance', cite: 'Art. 28(3)(f)', title: 'Assistance with Art. 32–36', question: 'Is assistance with security, breach notification and impact assessments covered?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'deletion', cite: 'Art. 28(3)(g)', title: 'Deletion or return at the end', question: 'Does the controller get to choose deletion or return, with a stated period?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'audit', cite: 'Art. 28(3)(h)', title: 'Information and audits', question: 'Does the processor make available the information needed to demonstrate compliance and allow audits?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'annex-i', cite: 'SCC Annex I', title: 'Annex I — the parties and the processing', question: 'Are subject matter, duration, nature, purpose, data categories and data subjects all described?', severity: 'blocker', code: 'art28/missing-clause' },
    { id: 'annex-ii', cite: 'SCC Annex II', title: 'Annex II — technical and organisational measures', question: 'Are the measures specific enough to be assessed, rather than a list of adjectives?', severity: 'warn', code: 'art28/missing-clause' },
    { id: 'annex-iii', cite: 'SCC Annex III', title: 'Annex III — sub-processors', question: 'Is the sub-processor annex generated from the register ({{processor-table:annex}}) rather than typed?', severity: 'warn', code: 'art28/missing-clause' },
    { id: 'transfers', cite: 'Art. 46, SCC', title: 'Transfer mechanism', question: 'Where transfers happen, are the SCCs (with the UK addendum where relevant) incorporated and the modules identified?', severity: 'blocker', code: 'art28/missing-clause', appliesWhen: { offersToEEA: true } },
    { id: 'breach-timing', cite: 'Art. 33(2)', title: 'Breach notification timing', question: 'Is the processor bound to notify without undue delay, with a concrete period?', severity: 'warn', code: 'art28/missing-clause' },
  ],
}

const terms: Checklist = {
  kind: 'terms',
  label: 'Terms of service',
  intro:
    'Not a data protection document, but it is where contradictions with the privacy policy surface — a licence to “all data you submit” next to a privacy policy promising deletion, for example.',
  requirements: [
    { id: 'parties', cite: '—', title: 'Who the contract is with', question: 'Is the contracting entity the same one the privacy policy names as controller?', severity: 'blocker', code: 'contradiction/page-vs-page', needsInput: ['legalName'] },
    { id: 'governing-law', cite: '—', title: 'Governing law and forum', question: 'Are both stated?', severity: 'warn', code: 'art13/missing-disclosure', needsInput: ['governingLaw'] },
    { id: 'changes', cite: '—', title: 'How terms change', question: 'Is there a stated process and notice period for changes?', severity: 'warn', code: 'art13/missing-disclosure' },
    { id: 'termination', cite: '—', title: 'Termination and data return', question: 'Does termination say what happens to the customer’s data, consistently with the DPA?', severity: 'warn', code: 'contradiction/page-vs-page' },
    { id: 'consumer-rights', cite: 'Dir. 2011/83/EU', title: 'Consumer withdrawal rights', question: 'For consumers in the EU, is the 14-day withdrawal right addressed?', severity: 'warn', code: 'art13/missing-disclosure', appliesWhen: { audience: ['b2c', 'both'] } },
  ],
}

export const CHECKLISTS: Record<string, Checklist> = { privacy, cookies, subprocessors, dpa, terms }

export function checklistFor(kind: string): Checklist | undefined {
  return CHECKLISTS[kind]
}

/**
 * Official GDPR terminology per language.
 *
 * A translated policy that says "kontroler" in Polish or "pristanak" in Croatian reads as a
 * machine translation of an English document, because that is what it is. The Regulation has
 * an official text in each of these languages; these are the words it uses.
 */
export const TERMINOLOGY: Record<string, Record<string, string>> = {
  en: { controller: 'controller', processor: 'processor', dataSubject: 'data subject', personalData: 'personal data', legalBasis: 'legal basis', supervisoryAuthority: 'supervisory authority', consent: 'consent', legitimateInterests: 'legitimate interests' },
  de: { controller: 'Verantwortlicher', processor: 'Auftragsverarbeiter', dataSubject: 'betroffene Person', personalData: 'personenbezogene Daten', legalBasis: 'Rechtsgrundlage', supervisoryAuthority: 'Aufsichtsbehörde', consent: 'Einwilligung', legitimateInterests: 'berechtigte Interessen' },
  fr: { controller: 'responsable du traitement', processor: 'sous-traitant', dataSubject: 'personne concernée', personalData: 'données à caractère personnel', legalBasis: 'base juridique', supervisoryAuthority: 'autorité de contrôle', consent: 'consentement', legitimateInterests: 'intérêts légitimes' },
  es: { controller: 'responsable del tratamiento', processor: 'encargado del tratamiento', dataSubject: 'interesado', personalData: 'datos personales', legalBasis: 'base jurídica', supervisoryAuthority: 'autoridad de control', consent: 'consentimiento', legitimateInterests: 'intereses legítimos' },
  it: { controller: 'titolare del trattamento', processor: 'responsabile del trattamento', dataSubject: 'interessato', personalData: 'dati personali', legalBasis: 'base giuridica', supervisoryAuthority: 'autorità di controllo', consent: 'consenso', legitimateInterests: 'legittimi interessi' },
  nl: { controller: 'verwerkingsverantwoordelijke', processor: 'verwerker', dataSubject: 'betrokkene', personalData: 'persoonsgegevens', legalBasis: 'rechtsgrond', supervisoryAuthority: 'toezichthoudende autoriteit', consent: 'toestemming', legitimateInterests: 'gerechtvaardigde belangen' },
  pl: { controller: 'administrator', processor: 'podmiot przetwarzający', dataSubject: 'osoba, której dane dotyczą', personalData: 'dane osobowe', legalBasis: 'podstawa prawna', supervisoryAuthority: 'organ nadzorczy', consent: 'zgoda', legitimateInterests: 'prawnie uzasadnione interesy' },
  pt: { controller: 'responsável pelo tratamento', processor: 'subcontratante', dataSubject: 'titular dos dados', personalData: 'dados pessoais', legalBasis: 'fundamento jurídico', supervisoryAuthority: 'autoridade de controlo', consent: 'consentimento', legitimateInterests: 'interesses legítimos' },
  hr: { controller: 'voditelj obrade', processor: 'izvršitelj obrade', dataSubject: 'ispitanik', personalData: 'osobni podaci', legalBasis: 'pravna osnova', supervisoryAuthority: 'nadzorno tijelo', consent: 'privola', legitimateInterests: 'legitimni interesi' },
  cs: { controller: 'správce', processor: 'zpracovatel', dataSubject: 'subjekt údajů', personalData: 'osobní údaje', legalBasis: 'právní základ', supervisoryAuthority: 'dozorový úřad', consent: 'souhlas', legitimateInterests: 'oprávněné zájmy' },
  sv: { controller: 'personuppgiftsansvarig', processor: 'personuppgiftsbiträde', dataSubject: 'registrerad', personalData: 'personuppgifter', legalBasis: 'rättslig grund', supervisoryAuthority: 'tillsynsmyndighet', consent: 'samtycke', legitimateInterests: 'berättigade intressen' },
  da: { controller: 'dataansvarlig', processor: 'databehandler', dataSubject: 'registreret', personalData: 'personoplysninger', legalBasis: 'retligt grundlag', supervisoryAuthority: 'tilsynsmyndighed', consent: 'samtykke', legitimateInterests: 'legitime interesser' },
}

/** Words that betray a literal translation from English rather than the official term. */
export const FALSE_FRIENDS: Record<string, Array<{ wrong: string; right: string }>> = {
  pl: [
    { wrong: 'kontroler', right: 'administrator' },
    { wrong: 'procesor danych', right: 'podmiot przetwarzający' },
  ],
  hr: [
    { wrong: 'kontrolor', right: 'voditelj obrade' },
    { wrong: 'pristanak', right: 'privola' },
  ],
  de: [{ wrong: 'Kontrolleur', right: 'Verantwortlicher' }],
  cs: [{ wrong: 'kontrolor', right: 'správce' }],
  nl: [{ wrong: 'controleur', right: 'verwerkingsverantwoordelijke' }],
  it: [{ wrong: 'controllore', right: 'titolare del trattamento' }],
  es: [{ wrong: 'controlador', right: 'responsable del tratamiento' }],
  pt: [{ wrong: 'controlador', right: 'responsável pelo tratamento' }],
  fr: [{ wrong: 'contrôleur des données', right: 'responsable du traitement' }],
}

export function terminologyFor(locale: string | undefined): { locale: string; terms?: Record<string, string>; falseFriends?: Array<{ wrong: string; right: string }>; note: string } {
  const code = (locale ?? 'en').split('-')[0].toLowerCase()
  const terms = TERMINOLOGY[code]
  return {
    locale: code,
    terms,
    falseFriends: FALSE_FRIENDS[code],
    note: terms
      ? 'Use these words. They are the ones the official text of the Regulation uses in this language.'
      : 'No glossary ships for this language. Take the terminology from the official text of the Regulation in this language rather than translating the English wording.',
  }
}
