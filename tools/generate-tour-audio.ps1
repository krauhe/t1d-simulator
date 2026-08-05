param(
    [string]$Language = "en",
    [string]$VoiceId = "qhEux886xDKbOdF7jkFP",
    [string]$ModelId = "eleven_multilingual_v2",
    [double]$Stability = -1,
    [double]$SimilarityBoost = -1,
    [double]$Style = -1,
    [string]$KeyPath = "mockups\2026-06-08_welcome-popup\.elevenlabs-key.txt.txt",
    [string]$Only = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Genererer mp3-filer til T1D Simulator Tour via ElevenLabs.
# Brug: .\tools\generate-tour-audio.ps1 -Language da
#       .\tools\generate-tour-audio.ps1 -Language en
#       .\tools\generate-tour-audio.ps1 -Language da -DryRun   (vis tekster uden at kalde API)
#
# VIGTIGT FOR DANSK LYD:
# Kør kun én fil ad gangen med -Only, så godkendte lydfiler ikke overskrives.
# Brug fuldt filnavn når flere filer deler prefix. Fx matcher -Only 09 både
# 09-food-meals.mp3 og 09-food-lowcarb.mp3.
# Kør altid en dry-run først og kontroller at æ, ø og å vises korrekt.
# På Windows PowerShell 5 kan almindelig powershell -File læse denne UTF-8-fil
# forkert før API-kaldet. Brug derfor denne UTF-8 scriptblock-kommando:
#   $script = [IO.File]::ReadAllText('.\tools\generate-tour-audio.ps1', [Text.Encoding]::UTF8); $block = [scriptblock]::Create($script); & $block -Language da -Only 08 -DryRun
# Fjern -DryRun når teksten er tjekket og kun den ønskede fil står som Generating.
# Brug rigtig dansk i TTS-teksten (æ, ø, å), ikke ae/oe/aa. Ved korte tal og
# alle tal skal skrives som cifre for ElevenLabs: 1, 2, 3, 15 minutter.
# Hvis overskriften lyder som en gentagelse af sætningen bagefter, skal
# overskriften udelades fra TTS-teksten.
#
# Alle 22 tour-trin er inkluderet for begge sprog. Filnavnene matcher de stier
# der refereres i js/welcome-tour.js TOURS-objektet og READY_TOUR_AUDIO_SOURCES.
#
# Stemme: Peter (qhEux886xDKbOdF7jkFP) - dansk community voice, god på begge sprog.
# Model: eleven_multilingual_v2
#
# Voice settings (sprog-specifikke defaults, kan overrides med parametre):
#   DA: Stability=0.34, SimilarityBoost=0.78, Style=0.85
#   EN: Stability=0.45, SimilarityBoost=0.78, Style=0.85
#   Stability:       Lav = mere variation/energi, høj = mere monoton/jævn
#   SimilarityBoost: Hvor tæt på original-stemmen
#   Style:           Ekspressivitet/engagement. VIGTIGT: under 0.75 giver
#                    Peter ustabil dansk udtale. 0.85 er testet OK.
#   use_speaker_boost = true
#
# API-nøglen læses fra den lokale nøglefil eller miljøvariablen ELEVENLABS_API_KEY.
# Nøglen printes aldrig.

$apiKey = $null
if (Test-Path -LiteralPath $KeyPath) {
    $apiKey = (Get-Content -LiteralPath $KeyPath -Raw).Trim()
}
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    $apiKey = [Environment]::GetEnvironmentVariable("ELEVENLABS_API_KEY")
}

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw "ELEVENLABS_API_KEY is not set, and no key was found at $KeyPath."
}

if ($Language -ne "en" -and $Language -ne "da") {
    throw "Supported languages: en, da. Use -Language en or -Language da."
}

$outputDir = Join-Path (Get-Location) "sounds\tour\$Language"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$headers = @{
    "xi-api-key" = $apiKey
    "Accept" = "audio/mpeg"
    "Content-Type" = "application/json"
}

# ============================================================================
# DANSKE TTS-TEKSTER (alle 22 trin)
# Forkortelser staves ud, tal skrives som cifre, og sætninger er tilpasset
# naturlig dansk tale.
# Style 0.85 giver god dansk udtale af æ/ø/å (lavere værdier giver dårlig udtale).
# ============================================================================
$tourLinesDa = @(
    @{ file = "00-overview.mp3"; text = "T1D Simulator er et læringsspil om type 1-diabetes og blodsukker. Du hjælper en fast, fiktiv karakter og udforsker, hvordan mad, insulin, aktivitet, søvn og stress påvirker karakterens simulerede blodsukker.`n`nSpillet bruger ikke dine helbredsdata og giver ikke behandlingsvejledning eller insulindoser til virkelige personer." },
    @{ file = "01-graph.mp3"; text = "Grafen. De grønne prikker er karakterens simulerede blodsukkermålinger over tid. Farvebåndene viser hvor hurtigt du optjener points. To x i bonuszonen, en x i målzonen, og en halv x ved moderat forhøjet blodsukker." },
    @{ file = "02-graph-daynight.mp3"; text = "Dag og nat. Grafen viser et døgn fra nul til fireogtyve. Mørke felter er nat, og det lysere felt er dag." },
    @{ file = "02-cgm.mp3"; text = "Blodsukker-tallet. Når simulationen kører, vises spilkarakterens aktuelle blodsukker her. Pilen viser om værdien er på vej op, ned, eller ligger stabilt. Målingen er forsinket 5 til 10 minutter i forhold til spilkarakterens faktiske blodsukker. Forsinkelsen ses tydeligst ved hurtige fald." },
    @{ file = "03-character.mp3"; text = "Karakteren. Før spilstart vælger du en fast, fiktiv karakter: et barn, en voksen eller en kraftig voksen. Kropsgruppen giver karakteren faste egenskaber i simulatoren. Figuren her viser den valgte karakter. I spillet hjælper du karakteren med at holde et stabilt blodsukker." },
    @{ file = "04-insulin.mp3"; text = "Insulin. Insulin-ikonet nederst åbner insulinpanelet. Her giver du spilkarakteren basal- og hurtiginsulin." },
    @{ file = "05-basal.mp3"; text = "Basal-insulin. Basal-insulin virker langsomt over mange timer. Følg karakterens blodsukker gennem rolige perioder, for eksempel om natten eller flere timer efter mad og hurtiginsulin, og læg mærke til, om det stiger eller falder. Basal kan gives som én daglig dosis eller fordeles på to doser." },
    @{ file = "06-fast.mp3"; text = "Hurtig insulin. Hurtiginsulin bruges til måltider og korrektioner. Effekt på blodsukkeret kommer typisk efter 30 til 45 minutter. Effekten er som regel stærkest efter 1 til 2 timer og aftager derefter. I O B betyder insulin on board: det betyder hurtiginsulin som stadig har virkning tilbage." },
    @{ file = "07-food.mp3"; text = "Mad-ikonet nederst åbner madpanelet. Der er tre rækker: hurtige kulhydrater, måltider, og lav-kulhydrat." },
    @{ file = "08-food-sugars.mp3"; text = "Hurtige kulhydrater. Nederste række er druesukker, juice, cola og slik, som virker hurtigt og kan bruges til at rette et lavt blodsukker op. Banan og chokolade indeholder også kulhydrat, men virker langsommere end ren druesukker eller juice." },
    @{ file = "09-food-meals.mp3"; text = "Måltider. Midterste række er hele måltider som pasta, pizza og burger. De hæver blodsukkeret langsommere end ren sukker, og typen af kulhydrat styrer farten. Fedt kan forsinke toppen. Det er pizza-effekten." },
    @{ file = "09-food-lowcarb.mp3"; text = "Lav-kulhydrat. Øverste række er lav-kulhydrat som æg, nødder, salat og bøf. De giver typisk en mindre og langsommere blodsukker-stigning end kulhydratrige måltider, fordi der er få kulhydrater. Protein og fedt kan stadig give en senere stigning, og fedt kan sænke insulinfølsomheden i nogle timer. I simulatoren kan den langsommere effekt være lettere at matche med hurtiginsulin, fordi injiceret insulin virker langsommere end kroppens egen insulinfrigivelse." },
    @{ file = "10b-activityoverview.mp3"; text = "Aktivitets-ikonet nederst åbner aktivitetspanelet. Tryk på det for at planlægge motion." },
    @{ file = "10-activity.mp3"; text = "Aktivitet. Vælg først aktivitetstype og intensitet. Cardio bruger musklerne jævnt og sænker ofte blodsukkeret, især hvis der er aktiv hurtiginsulin. Styrke eller høj intensitet kan først hæve blodsukkeret kortvarigt, fordi stresshormoner frigiver glukose, men bagefter kan insulinfølsomheden stadig være højere. Nederst vælger du varighed. Når du trykker 15 minutter, 30 minutter, 60 minutter eller Åben, starter aktiviteten med de valg du har sat." },
    @{ file = "11b-kitoverview.mp3"; text = "T1D Kit-ikonet nederst åbner måleudstyr, druesukker og glukagon." },
    @{ file = "11-kit.mp3"; text = "I kittet kan du måle blodsukker og ketoner og bruge druesukker eller en glukagonpen. En fingerprik viser spilkarakterens aktuelle blodsukker uden C G M-forsinkelse. En ketonmåling viser ketoner. Ketoner kan stige, når kroppen mangler insulin og i stedet nedbryder fedt. Druesukker hæver blodsukkeret hurtigt. Glukagonpennen kan bruges ved svær hypo i spillet." },
    @{ file = "12b-timecontrols.mp3"; text = "Tidskontrol. Midterknappen sætter spillet på pause og starter det igen. Pilene ændrer tempoet: én, fire, tolv eller fireogtyve simulerede timer i minuttet. Brug lavt tempo eller pause, når du skal vælge handlinger. Brug højt tempo, når der ikke sker så meget, for eksempel når spilkarakteren sover." },
    @{ file = "13-physiology.mp3"; text = "Indsigt rummer 2 mere avancerede værktøjer. Fysiologi-visning viser, hvad der sker i modellen. Hvad Nu Hvis lader dig ændre de valg, du allerede har foretaget i en bane, og se et andet muligt forløb." },
    @{ file = "13b-settings.mp3"; text = "Settings-knappen åbner indstillingerne. Her kan du skifte blodsukker-enhed, slå bane-tips og generelle tips til eller fra, og styre lyd, musik og visning." },
    @{ file = "14-learn.mp3"; text = "Mens du spiller, dukker der tips op her. Ikonet til højre for tippet åbner spilguiden på det samme emne. Hjælp-knappen øverst er der også altid." },
    @{ file = "15-ready.mp3"; text = "Klar. Det var rundturen. Et godt næste skridt er at starte en kampagne, hvor værktøjerne låses op gradvist, mens du lærer hvordan de påvirker blodsukkeret. Du kan åbne rundturen igen fra Hjælp." }
)

# ============================================================================
# ENGELSKE TTS-TEKSTER (alle 22 trin)
# ============================================================================
$tourLinesEn = @(
    @{ file = "00-overview.mp3"; text = "T1D Simulator is a learning game about type 1 diabetes and blood sugar. You help a fixed, fictional character and explore how food, insulin, activity, sleep, and stress affect the character's simulated blood sugar.`n`nThe game does not use your health data and does not provide treatment guidance or insulin doses for real people." },
    @{ file = "01-graph.mp3"; text = "The graph. The green dots are the character's simulated blood glucose readings over time. The colored bands show how fast you earn points. Two x in the bonus zone, one x in the target range, and half x for moderately elevated blood glucose." },
    @{ file = "02-graph-daynight.mp3"; text = "Day and night. The graph shows one day from midnight to midnight. Dark areas are night, and the lighter area is daytime." },
    @{ file = "02-cgm.mp3"; text = "The blood glucose number. When the simulation is running, the game character's current blood glucose is shown here. The arrow shows whether the value is rising, falling, or steady. The reading is delayed 5 to 10 minutes compared with the game character's actual blood glucose. The delay is most visible during fast drops." },
    @{ file = "03-character.mp3"; text = "The character. Before the game starts, you choose a fixed fictional character: a child, an adult or a larger adult. The body group gives the character fixed properties in the simulator. The figure here shows the selected character. In the game, you help the character keep their blood glucose stable." },
    @{ file = "04-insulin.mp3"; text = "Insulin. The insulin icon at the bottom opens the insulin panel. This is where you give the game character basal and rapid insulin." },
    @{ file = "05-basal.mp3"; text = "Basal insulin. Basal insulin acts slowly over many hours. Follow the character's blood glucose through quiet periods, such as overnight or several hours after food and rapid insulin, and notice whether it rises or falls. Basal can be given as one daily dose or split into two doses." },
    @{ file = "06-fast.mp3"; text = "Rapid insulin. Rapid insulin is used for meals and corrections. The effect on blood sugar typically comes after thirty to forty five minutes. It usually has its strongest effect after one to two hours and then tapers off. I O B means insulin on board: it means rapid insulin that still has effect left." },
    @{ file = "07-food.mp3"; text = "Food. The food icon at the bottom opens the food panel. We go through the three fixed rows from most common to least common: fast carbs, meals, and low carb." },
    @{ file = "08-food-sugars.mp3"; text = "Fast carbs. The bottom row is dextrose, juice, cola and candy, which work quickly and can bring low blood sugar back up. Banana and chocolate are carbs too, but slower than pure dextrose or juice." },
    @{ file = "09-food-meals.mp3"; text = "Meals. The middle row is full meals like pasta, pizza and burger. They raise blood sugar more slowly than pure sugar, and the type of carb sets the pace. Fat can delay the peak. That is the pizza effect." },
    @{ file = "09-food-lowcarb.mp3"; text = "Low carb. The top row is low carb food like eggs, nuts, salad and steak. These usually give a smaller, slower blood sugar rise than carb heavy meals because they contain few carbs. Protein and fat can still create a later rise, and fat can temporarily reduce insulin sensitivity. In the simulator, that slower effect can be easier to match with rapid insulin, because injected insulin works more slowly than the body's own insulin release." },
    @{ file = "10b-activityoverview.mp3"; text = "Activity. The activity icon at the bottom opens the activity panel. Tap it to plan a workout." },
    @{ file = "10-activity.mp3"; text = "Activity. First choose activity type and intensity. Cardio uses the muscles steadily and often lowers blood sugar, especially when rapid insulin is active. Strength or high intensity can raise blood sugar briefly at first because stress hormones release glucose, but insulin sensitivity can still be higher afterward. At the bottom, choose duration. Pressing fifteen minutes, thirty minutes, sixty minutes or Open starts the activity with the choices you selected." },
    @{ file = "11b-kitoverview.mp3"; text = "The kit icon at the bottom opens measuring tools, dextrose and glucagon." },
    @{ file = "11-kit.mp3"; text = "In the kit, you can check blood glucose and ketones and use dextrose or a glucagon pen. A fingerprick shows the game character's current blood glucose without C G M delay. A ketone test checks ketones. Ketones can rise when the body lacks insulin and breaks down fat instead. Dextrose raises blood glucose quickly. The glucagon pen can be used for severe hypoglycemia in the game." },
    @{ file = "12b-timecontrols.mp3"; text = "Time controls. The middle button pauses the game and starts it again. The arrows change the pace: one, four, twelve or twenty-four simulated hours per minute. Use a slow pace or pause when choosing actions. Use a high pace when not much is happening, for example when the game character is sleeping." },
    @{ file = "13-physiology.mp3"; text = "Insights contains 2 more advanced tools. Physiology view shows what is happening in the simulator. What If lets you change choices you have already made in a level and see another possible course." },
    @{ file = "13b-settings.mp3"; text = "The Settings button opens the app controls. Here you can change the blood sugar unit, turn level tips and general tips on or off, and control sound, music and display options." },
    @{ file = "14-learn.mp3"; text = "While you play, tips appear here. The icon to the right of a tip opens the game guide on the same topic. The Help button at the top is always there too." },
    @{ file = "15-ready.mp3"; text = "Ready. That was the tour. A good next step is to start a Campaign, where the tools unlock gradually as you learn how they affect blood sugar. You can reopen the tour from Help." }
)

$tourLines = if ($Language -eq "da") { $tourLinesDa } else { $tourLinesEn }

# -Only filtrerer til en enkelt fil, saa vi kan regenerere praecis ét trin ad gangen
# uden at overskrive de allerede godkendte filer. Matcher baade "08" og "08-food-sugars.mp3".
if (-not [string]::IsNullOrWhiteSpace($Only)) {
    $tourLines = @($tourLines | Where-Object { $_.file -eq $Only -or $_.file -like "$Only*" })
    if ($tourLines.Count -eq 0) {
        throw "No tour line matched -Only '$Only'. Use a filename or prefix, e.g. -Only 08 or -Only 08-food-sugars.mp3"
    }
}

foreach ($line in $tourLines) {
    $target = Join-Path $outputDir $line.file
    Write-Output "Generating $($line.file)"

    if ($DryRun) {
        Write-Output $line.text
        continue
    }

    # Sprogspecifikke voice settings. Dansk kræver lav stability (0.34) og høj
    # style (0.85) for korrekt udtale af æ, ø og å. Engelsk tåler højere stability
    # (0.45), som giver jævnere tempo uden speed-bursts.
    if ($Language -eq "da") {
        $stab = if ($Stability -ge 0) { $Stability } else { 0.34 }
        $sim  = if ($SimilarityBoost -ge 0) { $SimilarityBoost } else { 0.78 }
        $sty  = if ($Style -ge 0) { $Style } else { 0.85 }
    } else {
        $stab = if ($Stability -ge 0) { $Stability } else { 0.45 }
        $sim  = if ($SimilarityBoost -ge 0) { $SimilarityBoost } else { 0.78 }
        $sty  = if ($Style -ge 0) { $Style } else { 0.85 }
    }

    $body = @{
        text = $line.text
        model_id = $ModelId
        language_code = $Language
        voice_settings = @{
            stability = $stab
            similarity_boost = $sim
            style = $sty
            use_speaker_boost = $true
        }
    } | ConvertTo-Json -Depth 5

    # PowerShell sender som default Windows-1252 i request body, men ElevenLabs
    # kraever UTF-8. Konverter eksplicit til UTF-8 bytes.
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

    $uri = "https://api.elevenlabs.io/v1/text-to-speech/${VoiceId}?output_format=mp3_44100_128"
    Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $bodyBytes -OutFile $target | Out-Null

    $bytes = (Get-Item $target).Length
    if ($bytes -lt 1000) {
        throw "Generated file is unexpectedly small: $target"
    }
    Write-Output "OK $($line.file) $bytes bytes"
}

Write-Output "`nDone: $($tourLines.Count) files generated in $outputDir"
