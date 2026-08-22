export const labelsActionFr = {
  lang: "fr",

  page1Eyebrow: "AGIR À SON ÉCHELLE",
  page1TitleLine1: "Le constat, c'est fait.",
  page1TitleLine2: "Voici ce qu'on peut faire.",
  page1Subtitle: "Des leviers concrets, chiffrés et sourcés — du geste individuel à la pression citoyenne.",

  transportTitle: "TRANSPORT",
  transportHeadline: "Le premier poste d'émissions du quotidien",
  transportText: "En France, les transports sont le premier poste d'émissions de gaz à effet de serre — et la voiture individuelle, utilisée seule, en concentre plus de la moitié.",
  transportBars: [
    { label: "Voiture seul(e)", value: "218 g/km", percent: 100, colorVar: "coral" },
    { label: "Voiture à 4", value: "55 g/km", percent: 25, colorVar: "amber" },
    { label: "Voiture électrique", value: "~20 g/km", percent: 9, colorVar: "amber" },
    { label: "TGV", value: "~3 g/km", percent: 1.4, colorVar: "forest-medium" },
    { label: "Vélo / marche", value: "0 g/km", percent: 0, colorVar: "forest" }
  ],
  transportSource: "Émissions directes par kilomètre et par passager, France. Source : Base Empreinte ADEME.",

  // Nuance l'intérêt de la voiture électrique selon l'intensité carbone
  // réelle du réseau électrique du pays (voir lib/gridIntensity.js).
  // "tier" vaut "low" | "medium" | "high" | null (donnée indisponible).
  gridNoteTransport: (countryName, tier) => {
    if (tier === "low") return `${countryName} a un réseau électrique largement décarboné : la voiture électrique y limite vraiment les émissions, bien au-delà du simple confort de conduite.`;
    if (tier === "medium") return `${countryName} a un réseau électrique d'intensité carbone modérée : la voiture électrique y reste un vrai progrès, mais moins radical que dans un pays au réseau très décarboné.`;
    if (tier === "high") return `${countryName} a un réseau électrique encore largement carboné : l'intérêt climatique de la voiture électrique y est réel, mais restera limité tant que la production d'électricité elle-même ne se décarbone pas.`;
    return "Le mix électrique de ce pays n'est pas encore disponible dans nos données — impossible de nuancer plus précisément l'intérêt local de la voiture électrique.";
  },

  logementTitle: "LOGEMENT",
  logementHeadline: "Isolation, chauffage, solaire",
  logementMythLabel: "Idée reçue",
  logementMyth1: "« L'isolation, c'est cher et ça ne se rentabilise jamais. »",
  logementFactLabel: "En réalité",
  logementFact1: "Le surcoût initial se rembourse le plus souvent en quelques années grâce aux économies de chauffage réalisées chaque hiver — et des aides publiques existent pour réduire ce coût de départ.",
  logementMyth2: "« Le solaire ne vaut le coup que dans les pays très ensoleillés. »",
  logementFact2: "Les panneaux solaires produisent de l'électricité même par temps couvert — plusieurs pays à climat tempéré comptent parmi les plus gros producteurs mondiaux d'énergie solaire.",

  gridNoteSolar: (countryName, tier) => {
    if (tier === "low") return `${countryName} a déjà un réseau électrique largement décarboné : l'intérêt du solaire résidentiel y est surtout une question d'autonomie et de facture, plus que de climat.`;
    if (tier === "medium") return `${countryName} a un réseau électrique d'intensité carbone modérée : chaque kWh produit chez soi en solaire y évite une part réelle d'émissions.`;
    if (tier === "high") return `${countryName} a un réseau électrique encore largement carboné : le solaire résidentiel y a un impact climatique particulièrement net, kWh pour kWh.`;
    return "Le mix électrique de ce pays n'est pas encore disponible dans nos données — impossible de nuancer plus précisément l'intérêt local de la voiture électrique.";
  },

  page2Eyebrow: "EAU & ACTION CITOYENNE",
  page2TitleLine1: "Des gestes simples.",
  page2TitleLine2: "Un vrai poids collectif.",
  page2Subtitle: "L'eau qu'on économise chez soi, et le levier qu'aucun geste individuel ne remplace : la décision publique.",

  eauTitle: "EAU",
  eauIntro: "Un Français consomme en moyenne 143 litres d'eau potable par jour. Quelques réflexes suffisent à réduire ce chiffre sans effort notable.",
  eauFacts: [
    { num: "100 L", label: "une douche de 15 min" },
    { num: "35 L", label: "la même douche en 5 min" },
    { num: "120 L/j", label: "gaspillés par un robinet qui goutte" },
    { num: "600 L/j", label: "gaspillés par une chasse d'eau qui fuit" }
  ],
  eauSource: "Source : ADEME (agirpourlatransition.ademe.fr).",

  citoyenTitle: "ACTION CITOYENNE",
  citoyenHeadline: "Le levier que peu de sites vous donnent",
  citoyenText: "Les gestes individuels comptent, mais les décisions publiques (transports en commun, rénovation énergétique, protection des forêts) changent l'échelle. Ce site suit déjà vos élus et leurs votes — utilisez-le.",
  citoyenCta: "Trouver et suivre mon élu sur pasdeplaneteb.com/deputes",

  closingTitle: "Comprendre. Comparer. Agir.",
  closingText: "Retrouvez toutes les données, sources et comparaisons pays par pays.",
  sourcesGeneral: "Sources : ADEME • GIEC (AR5, facteurs d'émission électriques) • pasdeplaneteb.com",

  ogFallbackTitle: "Agir à son échelle contre le changement climatique",
  ogTagline: "Kit de communication — passer à l'action, sourcé",

  page3Eyebrow: "ARBRES & CONSOMMATION",
  page3TitleLine1: "Ce qu'on plante.",
  page3TitleLine2: "Ce qu'on achète.",
  page3Subtitle: "Deux leviers où la bonne intention ne suffit pas toujours — ce que montrent vraiment les données.",

  arbresTitle: "ARBRES & BIODIVERSITÉ",
  arbresHeadline: "Planter utile, pas juste planter",
  arbresMythLabel: "Idée reçue",
  arbresMyth: "« Un arbre exotique à croissance rapide capture plus vite le CO2, donc c'est le meilleur choix. »",
  arbresFactLabel: "En réalité",
  arbresFact: "Vitesse de croissance ne veut pas dire utilité écologique : une essence locale bien choisie stocke du carbone sur des décennies, résiste mieux aux sécheresses et aux maladies, et nourrit tout un écosystème — une espèce exotique ou invasive peut au contraire l'appauvrir. Le bon choix d'essence évolue avec le changement climatique : renseignez-vous auprès de votre service forestier local (ONF, CNPF ou équivalent) plutôt que de suivre une liste figée.",
  arbresQuestionsIntro: "Avant de planter : 4 questions à poser à votre pépiniériste ou service forestier local",
  arbresQuestions: [
    "Cette essence est-elle native de ma région, ou au moins bien adaptée à son climat actuel ?",
    "Est-elle signalée comme invasive quelque part à proximité ?",
    "A-t-elle des besoins en eau compatibles avec des sécheresses de plus en plus fréquentes ?",
    "Le service forestier recommande-t-il une « migration assistée » (planter dès aujourd'hui des essences adaptées au climat de demain) dans ma zone ?"
  ],
  arbresQuestionsWho: "En France : ONF ou CNPF. Ailleurs : l'équivalent local — ces services évoluent leurs recommandations chaque année avec les nouvelles données de sécheresse.",

  consoTitle: "CONSOMMATION",
  consoIndustryHeadline: "Industrie lourde vs commerce local : une question d'échelle",
  consoIndustryText: "Le plus gros site industriel français émet, à lui seul, l'équivalent de dizaines de milliers de petits commerces réunis.",
  consoIndustryFacts: [
    { num: "8,5 Mt", label: "CO2/an — site le plus émetteur de France (2024)" },
    { num: "~50-70 t", label: "CO2/an — ordre de grandeur, petite boulangerie" },
    { num: "×120 000", label: "environ, entre les deux" }
  ],
  consoIndustryNote: "Ça ne change rien à l'intérêt des gestes individuels — mais ça explique pourquoi la pression citoyenne sur les décisions industrielles et publiques peut peser bien plus lourd qu'un choix de consommation isolé.",
  consoGardenHeadline: "Cultiver son potager : ça dépend surtout comment",
  consoGardenMythLabel: "Ce qu'on pourrait croire",
  consoGardenMyth: "« Faire pousser ses légumes soi-même est forcément plus écologique que les acheter. »",
  consoGardenFactLabel: "Ce que montre la recherche",
  consoGardenFact: "Une étude publiée dans Landscape and Urban Planning (Cleveland et al., 2017) montre qu'un potager neuf (bacs achetés, terreau importé) peut avoir une empreinte carbone pire que l'agriculture conventionnelle. Le gain redevient net en réutilisant du matériel existant et en cultivant plusieurs saisons de suite, sans acheter de terreau neuf chaque année.",
  sourcesPage3: "Sources : Réseau Action Climat (classement des sites industriels) • Cleveland et al., Landscape and Urban Planning, 2017 • pasdeplaneteb.com",
};
