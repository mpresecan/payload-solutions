# Working in the language the page was written in

The GDPR has an official text in every EU language. Those texts are not translations of an
English original for terminology purposes — they are the law in that language, and they fix the
words. A policy that uses different words reads to a local reader like what it is: an English
document run through a translator.

## Rules

1. **Read the page in its own language.** Do not translate it into English to reason about it.
   Meaning gets lost in both directions, and the finding you raise will be about the translation
   rather than about the page.
2. **Draft in the target language directly.** Not "write it in English, then translate".
3. **Use the official terms.** `consent_read_page` and `consent_checklist` return the glossary
   for the locale.
4. **Match the register.** Legal documents in Polish, German or Croatian are not written in the
   voice of English SaaS marketing. A cheerful English privacy policy translated cheerfully
   reads as unserious in most European legal registers.
5. **Do not auto-translate across locales.** If the English changed, report the other locales as
   stale (`pages/locale-diverged` already covers structural drift) and let a person decide.
   Offer to draft the other locale properly; do not quietly produce it.
6. **Keep the tokens identical across locales.** `{{cookie-table}}` is the same token in every
   language; the plugin localises what it renders.

## The terms that matter

| Concept | de | fr | es | it | nl |
| --- | --- | --- | --- | --- | --- |
| controller | Verantwortlicher | responsable du traitement | responsable del tratamiento | titolare del trattamento | verwerkingsverantwoordelijke |
| processor | Auftragsverarbeiter | sous-traitant | encargado del tratamiento | responsabile del trattamento | verwerker |
| data subject | betroffene Person | personne concernée | interesado | interessato | betrokkene |
| personal data | personenbezogene Daten | données à caractère personnel | datos personales | dati personali | persoonsgegevens |
| consent | Einwilligung | consentement | consentimiento | consenso | toestemming |
| supervisory authority | Aufsichtsbehörde | autorité de contrôle | autoridad de control | autorità di controllo | toezichthoudende autoriteit |

| Concept | pl | hr | cs | pt | sv | da |
| --- | --- | --- | --- | --- | --- | --- |
| controller | administrator | voditelj obrade | správce | responsável pelo tratamento | personuppgiftsansvarig | dataansvarlig |
| processor | podmiot przetwarzający | izvršitelj obrade | zpracovatel | subcontratante | personuppgiftsbiträde | databehandler |
| data subject | osoba, której dane dotyczą | ispitanik | subjekt údajů | titular dos dados | registrerad | registreret |
| personal data | dane osobowe | osobni podaci | osobní údaje | dados pessoais | personuppgifter | personoplysninger |
| consent | zgoda | privola | souhlas | consentimento | samtycke | samtykke |
| supervisory authority | organ nadzorczy | nadzorno tijelo | dozorový úřad | autoridade de controlo | tillsynsmyndighet | tilsynsmyndighed |

## False friends

These are the words that give away a machine translation, and each is worth a
`language/register` finding when it appears in a published page:

- **Polish**: *kontroler* → **administrator**; *procesor danych* → **podmiot przetwarzający**.
- **Croatian**: *kontrolor* → **voditelj obrade**; *pristanak* → **privola**.
- **German**: *Kontrolleur* → **Verantwortlicher**. Note also *Auftragsverarbeiter*, not
  *Datenverarbeiter*.
- **Czech**: *kontrolor* → **správce**.
- **Italian**: note the trap — *responsabile del trattamento* is the **processor**; the
  controller is *titolare*. A document that maps "responsible" to "controller" has them
  reversed, which inverts the whole legal relationship.
- **Spanish / Portuguese**: *controlador* → **responsable / responsável pelo tratamento**.
- **Dutch**: *controleur* → **verwerkingsverantwoordelijke**.
- **Swedish / Danish**: English "controller" and "processor" left untranslated.

The Italian and Spanish cases are worth care: mixing up *titolare* and *responsabile* is not a
style problem, it is a document that assigns the obligations to the wrong party.

## Languages with no glossary here

The plugin ships terminology for twelve languages. For anything else, take the terms from the
official text of the Regulation in that language rather than translating from English, and say
in the finding that you did so.
