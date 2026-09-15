// =============================================================================
// GUIDE-DATA.JS - Spilguide: forklaringer mellem korte tips og BG-SCIENCE
// =============================================================================
// Guiden forklarer synlige handlinger og deres sammenhæng med blodsukkeret.
// Afsnit og ikoner deles af indholdsfortegnelsen, tiplinks og baneintroer.
// Engelsk er sync-reference; begge sprog følger samme afsnitsstruktur.
// guide-en-version: 2026-09-06-v1
// guide-da-translated-from-en: 2026-09-06-v1
// Præcise nøglekoblinger har forrang for generelle orddele i tipnøgler.
// =============================================================================

const GUIDE_SECTION_ICONS = {
    overview: 'assets/icons/app/event-note.png',
    modes: 'assets/icons/app/mode-campaign.png',
    'what-if': 'assets/icons/app/event-note.png',
    controls: 'assets/icons/app/settings-statistics.png',
    basal: 'assets/icons/app/basal-syringe-clock.png',
    'rapid-iob': 'assets/icons/app/rapid-syringe.png',
    food: 'assets/icons/app/meal-plate.png',
    'low-bg-kit': 'assets/icons/app/t1d-kit-pouch.png',
    activity: 'assets/icons/app/activity-shoe.png',
    cgm: 'assets/icons/app/event-cgm-alarm.png',
    'stress-dawn-illness': 'assets/icons/app/event-illness.png',
    ketones: 'assets/icons/app/status-ketone.png',
    'body-signals': 'assets/icons/app/blood-drop.png',
    energy: 'assets/icons/app/status-calorie-balance.png',
    points: 'assets/icons/app/mode-campaign.png',
    levelend: 'assets/icons/app/event-surprise.png',
};

const GUIDE_SECTIONS = [
    {
        id: 'overview',
        title: { en: "Getting started", da: "Kom godt i gang" },
        body: {
            en: `
                <p>You help a fictional character keep blood sugar stable. The campaign gradually shows how food, insulin, activity, sleep and stress affect blood sugar.</p>
                <p>The number and dots show sensor readings. The arrow shows the direction, and icons show when actions happened. An action can keep working long after you choose it. Try different choices and follow both early and delayed effects.</p>
            `,
            da: `
                <p>Du hjælper en fiktiv karakter med at holde blodsukkeret stabilt. Kampagnen viser gradvist, hvordan mad, insulin, aktivitet, søvn og stress påvirker blodsukkeret.</p>
                <p>Tallet og punkterne viser sensorens målinger. Pilen viser retningen, og ikonerne viser handlingernes tidspunkter. En handling kan virke længe efter, at du har valgt den. Prøv forskellige valg, og følg både de tidlige og sene virkninger.</p>
            `,
        },
    },
    {
        id: 'modes',
        title: { en: "Campaign and Box Challenge", da: "Kampagne og Box Challenge" },
        body: {
            en: `
                <p><strong>Campaign:</strong> Each level adds a topic, such as meals or exercise. Its introduction explains the task and goal. More food choices and activities become available as you progress.</p>
                <p><strong>Box Challenge:</strong> Keep blood sugar out of the boxes on the graph and collect points. You have 3 lives. Hitting a box costs a life, and the character continues from a new starting point.</p>
            `,
            da: `
                <p><strong>Kampagne:</strong> Hver bane tilføjer et emne, fx måltider eller motion. Introen forklarer opgaven og målet. Undervejs får du adgang til flere madvalg og aktiviteter.</p>
                <p><strong>Box Challenge:</strong> Hold blodsukkeret fri af kasserne på grafen, og saml points. Du har 3 liv. Rammer blodsukkeret en kasse, mister du et liv, og karakteren fortsætter fra et nyt udgangspunkt.</p>
            `,
        },
    },
    {
        id: 'controls',
        title: { en: "Speed, shortcuts and Insights", da: "Tempo, genveje og Insights" },
        body: {
            en: `
                <p>The speed controls change how fast time passes. Slow down to choose an action, or speed up to follow longer-lasting effects. Pause gives you time to read.</p>
                <p>On PC: <strong>Space</strong> starts or pauses; <strong>← / →</strong> change speed. <strong>Z</strong> opens insulin, <strong>X</strong> food, <strong>C</strong> exercise and <strong>V</strong> the T1D kit. <strong>Escape</strong> closes the panel. The <strong>½ and 1–9</strong> keys give the character that number of rapid-insulin units during play.</p>
                <p><strong>Insights → Physiology view</strong> shows blood sugar without sensor noise, plus insulin action, carbohydrate absorption and ketones. <strong>eISF</strong> shows current insulin sensitivity: a higher value means stronger insulin action. Using this view prevents the level’s points and stars from being saved.</p>
            `,
            da: `
                <p>Hastighedskontrollen ændrer, hvor hurtigt tiden går. Sænk tempoet for at vælge en handling, eller skru op for at følge længerevarende virkninger. Pause giver tid til at læse.</p>
                <p>På PC: <strong>Mellemrum</strong> starter eller pauser; <strong>← / →</strong> ændrer tempoet. <strong>Z</strong> åbner insulin, <strong>X</strong> mad, <strong>C</strong> motion og <strong>V</strong> T1D-kittet. <strong>Escape</strong> lukker panelet. Tasterne <strong>½ og 1–9</strong> giver karakteren det antal enheder hurtiginsulin under spillet.</p>
                <p><strong>Insights → Fysiologi-visning</strong> viser blodsukkeret uden sensorstøj samt insulinvirkning, kulhydratoptag og ketoner. <strong>eISF</strong> viser den aktuelle insulinfølsomhed: højere værdi betyder kraftigere insulinvirkning. Ved brug af visningen gemmes banens points og stjerner ikke.</p>
            `,
        },
    },
    {
        id: 'what-if',
        title: { en: "What If", da: "Hvad Nu Hvis" },
        body: {
            en: `
                <p>Open <strong>Insights → What If</strong> after taking an action in a level. The level pauses. You can move, change, remove and add actions within the played period, still for the same character.</p>
                <p>The grey dashed line shows the original blood sugar; the coloured line shows your changes’ effects. After <strong>Level played to here</strong>, 6 greyed-out hours let you follow delayed effects.</p>
                <p>Boxes and fixed level events are locked. <strong>Variations</strong> shows several versions of an action, such as different timings. Points and result metrics are disabled.</p>
                <p><strong>Back to level</strong> reopens the original game. Your changes do not carry back.</p>
            `,
            da: `
                <p>Åbn <strong>Insights → Hvad Nu Hvis</strong> efter en handling i banen. Banen pauser. Du kan flytte, ændre, fjerne og tilføje handlinger inden for den spillede tid, stadig for samme karakter.</p>
                <p>Den grå stiplede linje viser det oprindelige blodsukker; den farvede viser ændringernes virkning. Efter <strong>Bane spillet hertil</strong> er der 6 gråtonede timer til at følge sene virkninger.</p>
                <p>Kasser og faste banehændelser er låst. <strong>Variationer</strong> viser flere udgaver af en handling, fx forskellige tidspunkter. Points og resultatmål er slået fra.</p>
                <p><strong>Tilbage til banen</strong> åbner det oprindelige spil igen. Ændringerne følger ikke med.</p>
            `,
        },
    },
    {
        id: 'basal',
        title: { en: "Basal insulin", da: "Basalinsulin" },
        body: {
            en: `
                <p>The liver releases glucose into the blood even when the character is not eating. <strong>Basal insulin</strong> acts slowly throughout the day and night and reduces this release.</p>
                <p>Too little basal insulin can therefore let blood sugar rise between meals. Too much can make it fall. Its effect builds over hours and fades slowly, so changes are not visible immediately.</p>
                <p>In the basal level, you can try different amounts and timings, including several separate doses. Follow blood sugar through the day. Periods without food, rapid insulin or activity make it easier to distinguish basal insulin’s effect from other influences.</p>
            `,
            da: `
                <p>Leveren frigiver glukose til blodet, også når karakteren ikke spiser. <strong>Basalinsulin</strong> virker langsomt gennem døgnet og dæmper denne frigivelse.</p>
                <p>For lidt basalinsulin kan derfor få blodsukkeret til at stige mellem måltiderne. For meget kan få det til at falde. Virkningen bygger sig op over timer og aftager langsomt, så ændringer ses ikke med det samme.</p>
                <p>I basalbanen kan du afprøve mængde og tidspunkt, også fordelt på flere doser. Følg blodsukkeret gennem dagen. Perioder uden mad, hurtiginsulin og aktivitet gør det lettere at skelne basalinsulinens virkning fra andre påvirkninger.</p>
            `,
        },
    },
    {
        id: 'rapid-iob',
        title: { en: "Rapid insulin and active insulin (IOB)", da: "Hurtiginsulin og aktiv insulin (IOB)" },
        body: {
            en: `
                <p><strong>Rapid insulin</strong> lowers the character’s blood sugar, but does not work immediately. Its effect builds and then fades over several hours. Food can raise blood sugar before insulin is working strongly.</p>
                <p><strong>IOB</strong> means insulin on board and shows how much of the character’s rapid insulin is still active. Basal insulin is not included. Doses given close together can overlap and cause a later fall, even while blood sugar is still rising now.</p>
                <p>Try insulin before, with or after a meal. Notice both the rise after food and any later fall. Activity, stress and sleep can change insulin action, so the same action does not always produce the same result.</p>
            `,
            da: `
                <p><strong>Hurtiginsulin</strong> sænker karakterens blodsukker, men virker ikke straks. Virkningen tager til og aftager derefter over flere timer. Mad kan nå at hæve blodsukkeret, før insulinen virker kraftigt.</p>
                <p><strong>IOB</strong> betyder insulin on board og viser, hvor meget af karakterens hurtiginsulin der stadig er aktiv. Basalinsulin indgår ikke i tallet. Flere doser tæt på hinanden kan overlappe og få blodsukkeret til at falde senere, selv om det stadig stiger nu.</p>
                <p>Afprøv insulin før, sammen med eller efter et måltid. Læg mærke til både stigningen efter maden og et eventuelt senere fald. Aktivitet, stress og søvn kan ændre insulinens virkning, så samme handling ikke altid giver samme resultat.</p>
            `,
        },
    },
    {
        id: 'food',
        title: { en: "Food and delayed rises", da: "Mad og forsinkede stigninger" },
        body: {
            en: `
                <p><strong>Carbohydrates</strong> in food are absorbed as sugars and can raise blood sugar. Dextrose and juice act quickly. Solid food needs to be broken down first and often produces a slower rise.</p>
                <p><strong>Fat</strong> slows stomach emptying, so carbohydrates reach the intestine more slowly. Fatty food already in the stomach can also delay sugar the character eats afterwards. Later, fat can weaken insulin action.</p>
                <p><strong>Protein</strong> can cause the liver to release more glucose. This effect comes later than the effect of fast carbohydrates and can last several hours.</p>
                <p>Low-carb meals contain little carbohydrate compared with protein and fat. Blood sugar can therefore rise slowly for a long time, even after rapid insulin has worn off. Compare snacks, ordinary meals and low-carb meals: when does the rise begin, and when does it fade?</p>
            `,
            da: `
                <p><strong>Kulhydrater</strong> fra mad optages som sukker og kan hæve blodsukkeret. Druesukker og juice virker hurtigt. Fast mad skal nedbrydes først og giver ofte en langsommere stigning.</p>
                <p><strong>Fedt</strong> forsinker mavens tømning, så kulhydraterne kommer langsommere videre til tarmen. Fed mad i maven kan derfor også forsinke sukker, som karakteren spiser bagefter. Senere kan fedt få insulin til at virke svagere.</p>
                <p><strong>Protein</strong> kan få leveren til at frigive mere glukose. Påvirkningen kommer senere end fra hurtige kulhydrater og kan vare flere timer.</p>
                <p>Low carb-måltider har få kulhydrater i forhold til protein og fedt. Blodsukkeret kan derfor stige langsomt og længe, også efter hurtiginsulinens virkning er aftaget. Sammenlign snacks, almindelige måltider og low carb: hvornår begynder stigningen, og hvornår aftager den?</p>
            `,
        },
    },
    {
        id: 'low-bg-kit',
        title: { en: "Low blood sugar and the T1D kit", da: "Lavt blodsukker og T1D-kit" },
        body: {
            en: `
                <p>Dextrose and juice can raise the character’s low blood sugar faster than an ordinary meal. The sugar still needs to be absorbed, while active insulin and exercise may continue lowering blood sugar.</p>
                <p>The T1D kit contains a <strong>fingerprick</strong> blood sugar check, a <strong>ketone test</strong>, <strong>glucagon</strong> and <strong>dextrose</strong>. Other food is selected in the food panel.</p>
                <p>Glucagon makes the liver release stored glucose. Its effect can be smaller if the character’s stores are low after prolonged activity or time without food. After use, the glucagon button has a waiting period; measurements and the food panel remain available.</p>
            `,
            da: `
                <p>Druesukker og juice kan hæve karakterens lave blodsukker hurtigere end et almindeligt måltid. Sukkeret skal dog stadig optages, mens aktiv insulin og motion kan fortsætte med at sænke blodsukkeret.</p>
                <p>T1D-kittet har <strong>fingerprik</strong> til blodsukkermåling, <strong>ketonmåling</strong>, <strong>glukagon</strong> og <strong>druesukker</strong>. Anden mad vælges i madpanelet.</p>
                <p>Glukagon får leveren til at frigive lagret glukose. Effekten kan være mindre, hvis karakterens lager er lavt efter lang aktivitet eller tid uden mad. Efter brug har glukagonknappen ventetid; målingerne og madpanelet kan stadig bruges.</p>
            `,
        },
    },
    {
        id: 'activity',
        title: { en: "Activity and exercise", da: "Aktivitet og motion" },
        body: {
            en: `
                <p>Working muscles take up more glucose, even without insulin. During activity, rapid insulin can also be absorbed faster and act more strongly. Even walking and housework can therefore lower blood sugar, especially when the character has active rapid insulin.</p>
                <p><strong>Cardio</strong>, such as running and cycling, typically lowers blood sugar during activity. <strong>Strength training</strong> can instead cause a rise because stress hormones make the liver release more glucose. <strong>Mixed exercise</strong> combines these influences.</p>
                <p>After exercise, insulin can act more strongly for several hours. A rise during strength training can therefore be followed by a later fall. Evening exercise can also affect blood sugar overnight.</p>
                <p>Compare types and intensities, or try the same activity at different times after insulin and food. This shows how activity’s effect depends on what is already happening in the body.</p>
            `,
            da: `
                <p>Arbejdende muskler optager mere glukose, også uden insulin. Under aktivitet kan hurtiginsulin desuden optages hurtigere og få kraftigere virkning. Selv gang og husarbejde kan derfor sænke blodsukkeret, især når karakteren har aktiv hurtiginsulin.</p>
                <p><strong>Cardio</strong>, fx løb og cykling, sænker typisk blodsukkeret under aktiviteten. <strong>Styrketræning</strong> kan i stedet give en stigning, fordi stresshormoner får leveren til at frigive mere glukose. <strong>Blandet motion</strong> kombinerer de to påvirkninger.</p>
                <p>Efter motion kan insulin virke kraftigere i flere timer. En stigning under styrketræning kan derfor godt efterfølges af et fald senere. Aftenmotion kan også påvirke blodsukkeret om natten.</p>
                <p>Sammenlign typer og intensiteter, eller prøv samme aktivitet på forskellige tidspunkter efter insulin og mad. Det viser, hvordan aktivitetens virkning afhænger af det, der allerede sker i kroppen.</p>
            `,
        },
    },
    {
        id: 'cgm',
        title: { en: "Sensor and fingerprick", da: "Sensor og fingerprik" },
        body: {
            en: `
                <p><strong>CGM</strong> is the sensor that measures glucose in the fluid under the skin. Its reading follows blood sugar with a delay and has small fluctuations. The difference is clearest when blood sugar changes quickly.</p>
                <p>A <strong>fingerprick</strong> in the T1D kit gives a more precise reading of the character’s current blood sugar. Physiology view shows simulated blood sugar without measurement error, making the sensor delay directly visible.</p>
                <p>In level 10, pressure on the sensor can cause falsely low readings, and signal problems can hide readings. This changes the information on screen, not blood sugar itself. A fingerprick can help you distinguish the two.</p>
            `,
            da: `
                <p><strong>CGM</strong> er sensoren, der måler glukose i væsken under huden. Målingen følger efter blodsukkeret med en forsinkelse og har små udsving. Forskellen ses tydeligst, når blodsukkeret ændrer sig hurtigt.</p>
                <p><strong>Fingerprik</strong> i T1D-kittet giver en mere præcis måling af karakterens aktuelle blodsukker. Fysiologi-visningen viser det simulerede blodsukker uden målefejl, så du kan se sensorens forsinkelse direkte.</p>
                <p>I bane 10 kan tryk på sensoren give falsk lave værdier, og signalproblemer kan skjule målinger. Det ændrer oplysningerne på skærmen, ikke blodsukkeret i sig selv. En fingerprik kan hjælpe dig med at skelne mellem de to.</p>
            `,
        },
    },
    {
        id: 'stress-dawn-illness',
        title: { en: "Morning rises, stress and illness", da: "Morgenstigning, stress og sygdom" },
        body: {
            en: `
                <p>In the morning, hormones can make the liver release more glucose and weaken insulin action. Blood sugar can therefore rise before breakfast. This is called the <strong>dawn effect</strong>.</p>
                <p>Stress and illness can also increase glucose release from the liver and weaken insulin action. The character’s blood sugar can therefore rise without a new meal. Events are marked on the graph so you can see what happened before the rise.</p>
                <p>Night-time actions can interrupt the character’s sleep. Too little sleep can increase stress effects the next day. Follow blood sugar during the disturbance and afterwards; its effects do not necessarily disappear when the event ends.</p>
            `,
            da: `
                <p>Om morgenen kan hormoner få leveren til at frigive mere glukose og få insulin til at virke svagere. Blodsukkeret kan derfor stige før morgenmaden. Det kaldes <strong>dawn-effekten</strong>.</p>
                <p>Stress og sygdom kan også øge leverens frigivelse af glukose og svække insulinens virkning. Karakterens blodsukker kan derfor stige uden et nyt måltid. Hændelserne er markeret på grafen, så du kan se, hvad der skete før stigningen.</p>
                <p>Handlinger om natten kan afbryde karakterens søvn. For lidt søvn kan øge stresspåvirkningen næste dag. Følg blodsukkeret både under påvirkningen og bagefter; virkningerne forsvinder ikke nødvendigvis, når hændelsen slutter.</p>
            `,
        },
    },
    {
        id: 'ketones',
        title: { en: "Ketones and insulin deficiency", da: "Ketoner og insulinmangel" },
        body: {
            en: `
                <p>When the body lacks insulin, more fat is released and the liver can turn it into <strong>ketones</strong>. Ketones can accumulate and make the blood acidic. This is called <strong>diabetic ketoacidosis (DKA)</strong>.</p>
                <p>Nausea, stomach pain, vomiting and deep, rapid breathing can be signs of DKA. Use the ketone test in the T1D kit to check the character’s ketones. High blood sugar alone does not tell you the ketone level.</p>
                <p>Insulin reduces ketone production. If the character’s ketones are high, you can check whether basal insulin is missing and follow measurements after your actions. Ketones fall gradually, not immediately after an injection.</p>
            `,
            da: `
                <p>Når kroppen mangler insulin, frigives mere fedt, som leveren kan omdanne til <strong>ketoner</strong>. Ketonerne kan stige og gøre blodet surt. Det kaldes <strong>diabetisk ketoacidose (DKA)</strong>.</p>
                <p>Kvalme, mavesmerter, opkast og dyb, hurtig vejrtrækning kan være tegn på DKA. Brug ketonmålingen i T1D-kittet til at undersøge karakterens ketoner. Højt blodsukker alene viser ikke, hvor mange ketoner der er.</p>
                <p>Insulin dæmper ketondannelsen. Hvis karakterens ketoner er høje, kan du undersøge, om der mangler basalinsulin, og følge målingerne efter dine handlinger. Ketonerne falder gradvist, ikke straks efter en indsprøjtning.</p>
            `,
        },
    },
    {
        id: 'body-signals',
        title: { en: "Symptoms", da: "Symptomer" },
        body: {
            en: `
                <p>The character’s symptoms can have several causes:</p>
                <ul><li><strong>Low blood sugar:</strong> sweating, trembling, palpitations, dizziness and confusion.</li><li><strong>High blood sugar:</strong> thirst, frequent urination, dry mouth and fatigue.</li><li><strong>DKA:</strong> nausea, stomach pain, vomiting, acetone smell and deep, rapid breathing.</li><li><strong>Illness:</strong> sore throat, sneezing, headache and fatigue.</li><li><strong>Energy deficit:</strong> hunger, weakness, irritability and headache.</li></ul>
                <p>Fatigue alone does not tell you whether the character needs food, is ill or has high blood sugar. Fingerprick and ketone tests provide more information.</p>
                <p>Repeated low blood sugar can weaken the body’s counter-response and make warning signs less noticeable. An absence of symptoms therefore does not rule out low blood sugar.</p>
                <p>Blur and fading colours also illustrate the character’s symptoms. These effects can be changed under <strong>Settings → VFX</strong>.</p>
            `,
            da: `
                <p>Karakterens symptomer kan have flere årsager:</p>
                <ul><li><strong>Lavt blodsukker:</strong> sved, rysten, hjertebanken, svimmelhed og forvirring.</li><li><strong>Højt blodsukker:</strong> tørst, hyppig vandladning, mundtørhed og træthed.</li><li><strong>DKA:</strong> kvalme, mavesmerter, opkast, acetonlugt og dyb, hurtig vejrtrækning.</li><li><strong>Sygdom:</strong> ondt i halsen, nys, hovedpine og træthed.</li><li><strong>Energiunderskud:</strong> sult, svaghed, irritabilitet og hovedpine.</li></ul>
                <p>Træthed alene fortæller fx ikke, om karakteren mangler mad, er syg eller har højt blodsukker. Fingerprik og ketonmåling giver flere oplysninger.</p>
                <p>Gentagne lave blodsukre kan svække kroppens modreaktion og gøre advarselstegnene mindre tydelige. Manglende symptomer udelukker derfor ikke lavt blodsukker.</p>
                <p>Slør og falmende farver illustrerer også karakterens symptomer. Effekterne kan ændres under <strong>Settings → VFX</strong>.</p>
            `,
        },
    },
    {
        id: 'energy',
        title: { en: "Food and energy", da: "Mad og energi" },
        body: {
            en: `
                <p><strong>Calorie balance</strong> is energy from the character’s food minus energy the body has used. A negative value means the character has used more than the food supplied. Activity increases energy use.</p>
                <p>In levels with a food goal, calorie balance is shown so you can follow whether the character has received enough energy. Meals with protein and fat also provide energy, even with few carbohydrates. Stable blood sugar and enough food are therefore two different goals.</p>
            `,
            da: `
                <p><strong>Kaloriebalance</strong> er energien fra karakterens mad minus den energi, kroppen har brugt. En negativ værdi betyder, at karakteren har brugt mere, end maden har givet. Aktivitet øger forbruget.</p>
                <p>I baner med et madmål vises kaloriebalancen, så du kan følge, om karakteren har fået energi nok. Måltider med protein og fedt bidrager også med energi, selv om de indeholder få kulhydrater. Stabilt blodsukker og nok mad er derfor to forskellige mål.</p>
            `,
        },
    },
    {
        id: 'points',
        title: { en: "Points and level goals", da: "Points og banemål" },
        body: {
            en: `
                <p>You earn points while the character’s blood sugar is in the coloured scoring zones. The green zone gives the most points. Campaign stars depend on the proportion of time in the target range, also called <strong>TIR</strong>.</p>
                <p>The level’s goals appear in its introduction, which you can reopen using the level icon on the graph. Some levels also require food or activity. Points do not replace these goals.</p>
                <p>The result tells you how the attempt went, but not why. Use the graph’s actions and the guide’s explanations to investigate a rise or fall before trying again.</p>
            `,
            da: `
                <p>Du optjener points, mens karakterens blodsukker er i de farvede pointområder. Det grønne område giver flest points. Kampagnens stjerner bygger på andelen af tiden i målområdet, også kaldet <strong>TIR</strong>.</p>
                <p>Banens mål står i introen og kan genåbnes via baneikonet på grafen. Nogle baner kræver også mad eller aktivitet. Points erstatter ikke disse mål.</p>
                <p>Resultatet fortæller, hvordan forsøget gik, men ikke hvorfor. Brug grafens handlinger og spilguidens forklaringer til at undersøge en stigning eller et fald, før du prøver igen.</p>
            `,
        },
    },
    {
        id: 'levelend',
        title: { en: "When a level ends", da: "Når banen slutter" },
        body: {
            en: `
                <p>The campaign ends when the level’s time is up or the character cannot continue. Very low blood sugar over time can leave the brain short of glucose. Insulin deficiency can lead to DKA. In Box Challenge, these events can cost lives, just as boxes can.</p>
                <p>The result screen shows the cause or the goals still missing. Start there: what happened? Then look at the actions before the event. For example, was insulin still working when blood sugar fell?</p>
                <p>The guide buttons explain the relevant connections. Choose something to watch for next time, and use <strong>Try again</strong> for another attempt.</p>
            `,
            da: `
                <p>Kampagnen slutter, når banens tid er gået, eller karakteren ikke kan fortsætte. Meget lavt blodsukker gennem længere tid kan give hjernen for lidt glukose. Insulinmangel kan føre til DKA. I Box Challenge kan de hændelser koste liv, ligesom kasserne.</p>
                <p>Resultatskærmen viser årsagen eller de mål, der mangler. Begynd dér: Hvad skete der? Se derefter på handlingerne før hændelsen. Var der fx stadig insulinvirkning, da blodsukkeret faldt?</p>
                <p>Guideknapperne forklarer de relevante sammenhænge. Vælg noget, du vil holde øje med næste gang, og brug <strong>Prøv igen</strong> til et nyt forsøg.</p>
            `,
        },
    },
];

const GUIDE_LEVEL_LINKS = {
    1: ['basal', 'rapid-iob', 'low-bg-kit'],
    2: ['stress-dawn-illness', 'rapid-iob', 'basal'],
    3: ['food', 'rapid-iob', 'low-bg-kit'],
    4: ['food', 'rapid-iob', 'energy'],
    5: ['food', 'rapid-iob', 'energy'],
    6: ['food', 'rapid-iob', 'energy'],
    7: ['activity', 'rapid-iob', 'energy'],
    8: ['activity', 'rapid-iob', 'energy'],
    9: ['stress-dawn-illness', 'ketones', 'body-signals'],
    10: ['cgm', 'stress-dawn-illness', 'food', 'activity'],
};

// Undtagelserne beskriver betydningen, ikke blot ordet "dose" eller "onset".
const GUIDE_KEY_EXCEPTIONS = {
    'campaign.level1.tip.splitdose': 'basal',
    'campaign.level2.tip.onsetuncertainty': 'stress-dawn-illness',
    'tips.nightaction': 'stress-dawn-illness',
};

const GUIDE_KEY_RULES = [
    { section: 'what-if', includes: ['whatif', 'what-if', 'variation'] },
    { section: 'points', includes: ['points', 'stars', 'tir', 'pointsHypoZero'] },
    { section: 'controls', includes: ['openDock', 'speedUp', 'speedControl', 'pauseButton', 'musicSettings', 'tipsOff', 'moreInfoIcons', 'physiologyMode', 'physiologySuggestion', 'physiologyEisf', 'keyboard'] },
    { section: 'energy', includes: ['kcal', 'calorie', 'energyDeficit'] },
    { section: 'low-bg-kit', includes: ['symptomHypo', 'glucagon', 'dextrose', 'lowBgDelay'] },
    { section: 'ketones', includes: ['symptomKetone', 'ketone', 'acidosis'] },
    { section: 'basal', includes: ['basal', 'bgRising'] },
    // Aktivitetsord skal have forrang for det generelle "iob", så fx
    // "cardioIob" fører til forklaringen af samspillet med motion.
    { section: 'activity', includes: ['activity', 'exercise', 'sport', 'motion', 'busRun', 'lifting', 'styrke', 'strategic', 'stopButton', 'cardioIob', 'strengthLater', 'level7.tip.intro'] },
    { section: 'rapid-iob', includes: ['bolus', 'rapid', 'iob', 'insulin', 'isf', 'icr', 'stack', 'dose', 'onset'] },
    { section: 'food', includes: ['food', 'meal', 'carb', 'pizza', 'cake', 'protein', 'fat', 'lowcarb', 'liquid', 'sweet', 'timescale'] },
    { section: 'cgm', includes: ['cgm', 'sensor', 'fingerprick', 'falseAlarms'] },
    { section: 'stress-dawn-illness', includes: ['dawn', 'stress', 'illness', 'sleep', 'presentation', 'conflict'] },
    { section: 'body-signals', includes: ['symptomHyper', 'symptomMultiple', 'symptomVfxSlowDown'] },
    { section: 'overview', includes: ['experiment', 'active'] },
];

function guideLang() {
    return (typeof appSettings !== 'undefined' && appSettings.language === 'en') ? 'en' : 'da';
}

function guideSectionForTextKey(textKey) {
    const key = String(textKey || '').toLowerCase();
    if (GUIDE_KEY_EXCEPTIONS[key]) return GUIDE_KEY_EXCEPTIONS[key];
    const rule = GUIDE_KEY_RULES.find(item =>
        item.includes.some(fragment => key.includes(fragment.toLowerCase()))
    );
    return rule ? rule.section : null;
}

function guideTitleForSection(sectionId, lang = guideLang()) {
    const section = GUIDE_SECTIONS.find(item => item.id === sectionId);
    if (!section) return sectionId;
    return section.title[lang] || section.title.en || sectionId;
}

function guideIconForSection(sectionId) {
    return GUIDE_SECTION_ICONS[sectionId] || '';
}
