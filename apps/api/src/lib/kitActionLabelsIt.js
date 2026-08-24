export const labelsActionIt = {
  lang: "it",

  page1Eyebrow: "AGIRE SU SCALA PERSONALE",
  page1TitleLine1: "La diagnosi è fatta.",
  page1TitleLine2: "Ecco cosa possiamo fare.",
  page1Subtitle: "Leve concrete e documentate — dal gesto individuale alla pressione civica.",

  transportTitle: "TRASPORTI",
  transportHeadline: "La prima fonte di emissioni quotidiane",
  transportText: "In Francia, i trasporti sono la prima fonte di emissioni di gas serra — e l'auto individuale, usata da sola, ne concentra più della metà.",
  transportBars: [
    { label: "Auto da solo/a", value: "218 g/km", percent: 100, colorVar: "coral" },
    { label: "Auto condivisa (4)", value: "55 g/km", percent: 25, colorVar: "amber" },
    { label: "Auto elettrica", value: "~20 g/km", percent: 9, colorVar: "amber" },
    { label: "Treno alta velocità", value: "~3 g/km", percent: 1.4, colorVar: "forest-medium" },
    { label: "Bici / a piedi", value: "0 g/km", percent: 0, colorVar: "forest" }
  ],
  transportSource: "Emissioni dirette per chilometro e passeggero, Francia. Fonte: Base Empreinte ADEME.",

  // Nuance l'intérêt de la voiture électrique selon l'intensité carbone
  // réelle du réseau électrique du pays (voir lib/gridIntensity.js).
  // "tier" vaut "low" | "medium" | "high" | null (donnée indisponible).
  gridNoteTransport: (countryName, tier) => {
    if (tier === "low") return `${countryName} ha una rete elettrica ampiamente decarbonizzata: un'auto elettrica lì riduce davvero le emissioni, ben oltre il semplice comfort di guida.`;
    if (tier === "medium") return `${countryName} ha una rete elettrica di intensità di carbonio moderata: l'auto elettrica lì resta un vero progresso, anche se meno radicale che in un paese con una rete molto pulita.`;
    if (tier === "high") return `${countryName} ha ancora una rete elettrica largamente carbonizzata: il beneficio climatico dell'auto elettrica lì è reale, ma resterà limitato finché la produzione elettrica stessa non si decarbonizzerà.`;
    return "Il mix elettrico di questo paese non è ancora disponibile nei nostri dati — non possiamo precisare ulteriormente l'interesse locale dell'auto elettrica.";
  },

  logementTitle: "CASA",
  logementHeadline: "Isolamento, riscaldamento, solare",
  logementMythLabel: "Falso mito",
  logementMyth1: "«Isolare è costoso e non si ripaga mai.»",
  logementFactLabel: "In realtà",
  logementFact1: "Il sovraccosto iniziale si ripaga spesso in pochi anni grazie ai risparmi sul riscaldamento ogni inverno — ed esistono aiuti pubblici per ridurre questo costo iniziale.",
  logementMyth2: "«Il solare conviene solo nei paesi molto soleggiati.»",
  logementFact2: "I pannelli solari producono elettricità anche con cielo nuvoloso — diversi paesi a clima temperato sono tra i maggiori produttori di energia solare al mondo.",

  gridNoteSolar: (countryName, tier) => {
    if (tier === "low") return `${countryName} ha già una rete elettrica ampiamente decarbonizzata: l'interesse del solare residenziale lì è soprattutto una questione di autonomia e bolletta, più che di clima.`;
    if (tier === "medium") return `${countryName} ha una rete elettrica di intensità di carbonio moderata: ogni kWh prodotto in casa con il solare lì evita una parte reale di emissioni.`;
    if (tier === "high") return `${countryName} ha ancora una rete elettrica largamente carbonizzata: il solare residenziale ha lì un impatto climatico particolarmente netto, kWh per kWh.`;
    return "Il mix elettrico di questo paese non è ancora disponibile nei nostri dati — non possiamo precisare ulteriormente l'interesse locale dell'auto elettrica.";
  },

  page2Eyebrow: "ACQUA E AZIONE CIVICA",
  page2TitleLine1: "Gesti semplici.",
  page2TitleLine2: "Un vero peso collettivo.",
  page2Subtitle: "L'acqua che risparmi a casa, e la leva che nessun gesto individuale sostituisce: la decisione pubblica.",

  eauTitle: "ACQUA",
  eauIntro: "Una persona in Francia consuma in media 143 litri di acqua potabile al giorno. Bastano pochi accorgimenti per ridurre questa cifra senza sforzo notevole.",
  eauFacts: [
    { num: "100 L", label: "una doccia di 15 min" },
    { num: "35 L", label: "la stessa doccia in 5 min" },
    { num: "120 L/giorno", label: "sprecati da un rubinetto che gocciola" },
    { num: "600 L/giorno", label: "sprecati da uno sciacquone che perde" }
  ],
  eauSource: "Fonte: ADEME (agirpourlatransition.ademe.fr).",

  citoyenTitle: "AZIONE CIVICA",
  citoyenHeadline: "La leva che pochi siti offrono",
  citoyenText: "I gesti individuali contano, ma le decisioni pubbliche (trasporto pubblico, ristrutturazione energetica, protezione delle foreste) cambiano scala. Questo sito segue già i tuoi rappresentanti e i loro voti — usalo.",
  citoyenCta: "Trova e segui il tuo rappresentante su pasdeplaneteb.com/deputes",

  closingTitle: "Capire. Confrontare. Agire.",
  closingText: "Trova tutti i dati, le fonti e i confronti paese per paese.",
  sourcesGeneral: "Fonti: ADEME • IPCC (AR5, fattori di emissione elettrica) • pasdeplaneteb.com",

  ogFallbackTitle: "Agire contro il cambiamento climatico, su scala personale",
  ogTagline: "Kit di comunicazione — passare all'azione, con fonti",

  page3Eyebrow: "ALBERI E CONSUMO",
  page3TitleLine1: "Ciò che piantiamo.",
  page3TitleLine2: "Ciò che compriamo.",
  page3Subtitle: "Due leve dove la buona intenzione non sempre basta — ciò che mostrano davvero i dati.",

  arbresTitle: "ALBERI E BIODIVERSITÀ",
  arbresHeadline: "Piantare con criterio, non solo piantare",
  arbresMythLabel: "Falso mito",
  arbresMyth: "«Un albero esotico a crescita rapida cattura più velocemente la CO2, quindi è la scelta migliore.»",
  arbresFactLabel: "In realtà",
  arbresFact: "Velocità di crescita non significa utilità ecologica: un'essenza autoctona ben scelta immagazzina carbonio per decenni, resiste meglio a siccità e malattie, e nutre un intero ecosistema — mentre una specie esotica o invasiva può invece impoverirlo. La scelta giusta cambia con il cambiamento climatico: rivolgiti al tuo servizio forestale locale invece di seguire una lista fissa.",
  arbresQuestionsIntro: "Prima di piantare: 4 domande da fare al tuo vivaio o servizio forestale locale",
  arbresQuestions: [
    "Questa essenza è autoctona della mia regione, o almeno ben adattata al suo clima attuale?",
    "È segnalata come invasiva da qualche parte nelle vicinanze?",
    "I suoi bisogni idrici sono compatibili con siccità sempre più frequenti?",
    "Il servizio forestale raccomanda una «migrazione assistita» (piantare oggi essenze adatte al clima di domani) nella mia zona?"
  ],
  arbresQuestionsWho: "Questi servizi aggiornano le loro raccomandazioni ogni anno con i nuovi dati sulla siccità — consulta quello della tua zona prima di piantare.",
  arbresGbifCta: "Vuoi sapere cosa cresce già vicino a te, verificato con GlobalTreeSearch? pasdeplaneteb.com/vegetation",

  consoIndustryDynamicIntro: "Una misura reale, non un confronto isolato",
  // countryName/year/pct fournis à l'appel (voir kitActionTemplate.js) —
  // year/pct viennent de sector_emissions (calcul réel), jamais inventés.
  consoIndustryDynamicText: (countryName, year, pct) => `In ${countryName} (${year}), i processi industriali (cemento, acciaio, chimica...) rappresentavano il ${pct} % delle emissioni totali di gas serra del paese — il resto proviene da energia, agricoltura, rifiuti e uso del suolo.`,
  consoIndustryFallbackPrefix: "Dato non ancora disponibile per questo paese. Come riferimento:",
  consoIndustrySource: "Fonte: Climate Watch (World Resources Institute).",

  sectorBreakdownTitle: "Ripartizione delle emissioni per settore",
  sectorNames: {
    "Energy": "Energia",
    "Industrial Processes": "Processi industriali",
    "Agriculture": "Agricoltura",
    "Waste": "Rifiuti",
    "Land-Use Change and Forestry": "Uso del suolo e foreste"
  },

  consoTitle: "CONSUMO",
  consoIndustryHeadline: "Industria pesante vs commercio locale: una questione di scala",
  consoIndustryText: "Il più grande sito industriale francese emette, da solo, l'equivalente di decine di migliaia di piccoli negozi messi insieme.",
  consoIndustryFacts: [
    { num: "8,5 Mt", label: "CO2/anno — sito più emissivo di Francia (2024)" },
    { num: "~50-70 t", label: "CO2/anno — ordine di grandezza, piccola panetteria" },
    { num: "×120.000", label: "circa, tra i due" }
  ],
  consoIndustryNote: "Questo non toglie valore ai gesti individuali — ma spiega perché la pressione civica sulle decisioni industriali e pubbliche può pesare molto più di una scelta di consumo isolata.",
  consoGardenHeadline: "Coltivare il proprio orto: dipende soprattutto da come",
  consoGardenMythLabel: "Ciò che si potrebbe pensare",
  consoGardenMyth: "«Coltivare da soli le proprie verdure è necessariamente più ecologico che comprarle.»",
  consoGardenFactLabel: "Ciò che mostra la ricerca",
  consoGardenFact: "Uno studio pubblicato su Landscape and Urban Planning (Cleveland et al., 2017) mostra che un orto nuovo (bancali acquistati, terriccio importato) può avere un'impronta di carbonio peggiore dell'agricoltura convenzionale. Il guadagno torna reale riutilizzando materiali esistenti e coltivando per più stagioni di seguito, senza comprare terriccio nuovo ogni anno.",
  sourcesPage3: "Fonti: Réseau Action Climat (classifica dei siti industriali) • Cleveland et al., Landscape and Urban Planning, 2017 • pasdeplaneteb.com",
};
