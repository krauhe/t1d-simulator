# Kontrol af rettelser og klargøring til én offentlig udgave

Genereret: 2026-10-25

Status: **Lokalt implementeret og kontrolleret. Ikke committet, pushet eller publiceret.**
Ejeren har besvaret #08 med en bestilling på yderligere glukoseanalyse.
Analysen er leveret i `2026-10-25_codex_glucose-feasibility.md`; modelændring og
udgivelsesrækkefølge er endnu ikke besluttet.

## 1. Scope og gennemgang af testnoter

Kilde: `developer input/25-10-2026 KRH.docx`. Punkter efter dokumentets TODO-afsnit
er ikke implementeret. Den første onboardingændring er et separat forslag og en
lokal skitse; kampagnens baner er ikke ændret som del af dette arbejde.

| Punkt | Resultat og status |
|---|---|
| Insights-intro | Konkrete, kortere forklaringer på dansk og engelsk. ✅ FIKSET lokalt (2026-10-25), med lydbegrænsningen nedenfor. |
| Hypoalarm og søvn | Friske lave CGM-målinger udløser en alarm pr. episode og vækker en sovende karakter gennem eksisterende søvnregnskab. ✅ FIKSET lokalt (2026-10-25). |
| Portionslabel | Større tekst og tydeligere kontrast. ✅ FIKSET lokalt (2026-10-25). |
| Slogan | “Eksperimentér, observér, lær, gentag” med engelsk pendant i relevante desktop- og mobilvisninger. ✅ FIKSET lokalt (2026-10-25). |
| Dage i Hvad Nu Hvis | Dagslabels over grafen, korrekt faktisk dag fra senere snapshots, synlig valgt tid efter rulning og korrekt placerede søvnstriber. ✅ FIKSET lokalt (2026-10-25). |
| Overflødigt “i spillet” | Fjernet i de berørte tips og forklaringer; den overordnede afgrænsning til fiktive karakterer er bevaret. ✅ FIKSET lokalt (2026-10-25). |
| Kontakt og credits | Kontakt mig/me samt Codex/OpenAI og Gemini/Google i credits. ✅ FIKSET lokalt (2026-10-25). |
| Druesukker i modellen | Ingen ændring af absorptionsparametre. Evidens, begrænsninger og næste modelopgave er beskrevet i `2026-10-25_glucose-model-plan.md`. ❌ ÅBEN. |
| Kampagne-highscores | Nummer og titel på samme linje, bredere kort og portræt uden gentaget synligt karakternavn. ✅ FIKSET lokalt (2026-10-25). |
| Måltider og mening i de første baner | Rapport og klikbar dansk/engelsk skitse er klar. ⚠️ DELVIST: forslag leveret, ingen ændringer af spilbare baner. |

## 2. Lokal verifikation

De eksisterende modeltests nedenfor blev kørt under arbejdet. Den samlede
browserpakke og tekstsynkronisering blev kontrolleret efter integration af de
sidste editor- og mobilrettelser. Testtal er antal checks i de respektive scripts,
ikke en samlet klinisk validering.

| Kontrol | Resultat |
|---|---|
| CGM-alarmregressioner | 8/8 |
| Uafhængige alarm-/søvnkanttilfælde | 6/6 |
| Engine API | 34/34 |
| Model-review-regressioner | 18/18 |
| Simulation | 197/197 |
| Exercise conservation | 20/20 |
| Golden master | 7/7 |
| Standalone parity | 10/10 |
| Clinical equivalence | 8/8 |
| Public release boundary | Bestået |
| Intended purpose | Bestået, 17 filer |
| Dynamiske karaktertekster | Bestået, 90 strenge, 6 karakterer og 2 sprog |
| Release-builder | 9/9 |
| Samlet lokal udgivelsespakke i browser | 6/6 |
| Slogan og relevante visninger | 20 tilstande kontrolleret |
| Versionshistorik | Bestået, 9 poster og 7 månedsopsummeringer |
| Dansk/engelsk synkronisering | Bestået, 852 nøgler pr. sprog og ens hjælp-markør |
| Diff-whitespace | Bestået |

Den afsluttende lokale pakke ligger i `.release-builds/2026-10-25-final-local`.
Den er mærket `localWorkingTree: true`, version `0.9.129-beta`, med
`a858b1e6be3b11a3a337375cff63a143110d2679` som Git-basis. Det commit identificerer
ikke de efterfølgende lokale ændringer. **Denne pakke må ikke uploades.**

Browserkontrollen startede kampagnen, åbnede madpanelet og fysiologivinduet,
kontrollerede desktop ved 1280×800 og 1920×1080, mobilrouting og gamle
preview-adresser, samt fravær af kanalskifter, JavaScript-fejl og manglende lokale
filer. Tone.js var erstattet med teststub; fysisk hørbar lyd er ikke verificeret.

## 3. Begrænsninger

1. Alarmen er én alarm pr. målt lav episode. En episode, som alarmerede før
   sengetid, giver ikke automatisk en ekstra alarm kl. 22. Grænserne 4,0 og
   4,5 mmol/L er eksplicitte spilindstillinger, ikke nye kliniske kalibreringer.
2. Turens eksisterende lydfiler `11-kit.mp3` og `13-physiology.mp3` på dansk og
   engelsk er ikke regenereret. De kan derfor afvige fra den reviderede tekst.
   Projektets regel kræver særskilt godkendelse af hvert præcist manuskript og
   filnavn før et betalt ElevenLabs-kald.
3. Det længere slogan passer på én linje ved både 320 og 375 px. En eksisterende
   afklipning af selve “T1D SIMULATOR”-logoordet ved 320 px er registreret og
   efterladt uden for denne rettelses scope. Desktop skjuler allerede sloganet
   ved visse smalle bredder.
4. Linkkontrollen omfattede 33 URL'er. GNU GPL-siden kunne ikke fuldt verificeres
   på grund af timeout. Facebook viser korrekt gruppe med login-/cookie-overlay.
   Hovorka-DOI'et blev identificeret korrekt gennem lokal HTTP, men headless
   browser fik CAPTCHA. Google Fonts' to origin-URL'er bruges alene som
   preconnect-hints og giver 404; den faktiske fontressource fungerer. Alle 12
   relevante GitHub-dokumentankre blev fundet. Ingen bekræftet død destinationsside
   blev fundet; dette er ikke en garanti for alle brugeres adgang.
5. HEAD indeholder også tidligere lokale ændringer, herunder exercise conservation,
   som ikke svarer til den ældre preview-udgave, ejeren testede. De relevante
   modelkontroller ovenfor er derfor medtaget.

## 4. Udgivelsesvej

Byggeren producerer én app i roden og små henvisningssider på gamle
preview-adresser. Mockups, private reviewpakker og rå forskningsmateriale er ikke
med i runtime-listen. Den historiske stable-pin er bevaret som reference, men
vælges ikke af den nye bygger.

GitHub Pages er allerede sat til GitHub Actions. Den nye workflow kræver manuel
start fra main, bygger fra commit, afviser working-tree-pakker og uploader kun
pakken, der bestod browserkontrollen. Et push alene publicerer ikke appen.

Efter beslutningen om glukose skal den endelige commit-pakke bygges og testes,
før publiceringsworkflowen køres. Derefter skal live-manifest, versionsnummer,
desktop, mobil og gamle preview-links kontrolleres mod det faktiske commit.

## 5. Delegation og artefakter

Tre afgrænsede Codex-agenter håndterede UI/tekster og integrationsreview,
udgivelsesstruktur og mobil-/linkkontrol samt onboardingforslag og mockup.
Root gennemgik ændringer og centrale screenshots og kørte den samlede kontrol.
Gemini 3.8 Flash kritiserede en afgrænset kulhydratpakke; Gemini 4 Argon
kritiserede onboardingforslaget. Deres forslag er vurderet, og udokumenterede
fysiologiske parametre er ikke indført. Rå modeloutput forbliver privat.

1. `tests/playwright/2026-10-25_10-18-ui/alarm-review.md`: alarm og editor.
2. `tests/playwright/single-release-1792921102052/`: samlet lokal pakke.
3. `tests/playwright/2026-10-25-slogan/`: 20 visningstilstande og screenshots.
4. `.local-artifacts/2026-10-25-links/report.md`: kvalificeret linkkontrol.
5. `docs/reviews/2026-10-25_cgm-low-alarm-fix.md`: model-/spiltilstandsbeslutning.
6. `docs/reviews/2026-10-25_glucose-model-plan.md`: åbent modelpunkt.
7. `docs/reviews/2026-10-25_onboarding-pilot.md`: forslag og evidensafgrænsning.
8. `mockups/2026-10-25_onboarding/index.html`: lokal skitse med illustrative
   kurver, uden forbindelse til den spilbare simulators tilstand.

Samlet status: lokale rettelser, onboardingoplæg og den efterspurgte glukoseanalyse
er klar. Glukosemodel og publicering er endnu ikke gennemført. Ingen betalt
lydgeneration udført.
