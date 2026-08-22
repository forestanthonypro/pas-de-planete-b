export const labelsActionEn = {
  lang: "en",

  page1Eyebrow: "TAKING ACTION",
  page1TitleLine1: "The facts are in.",
  page1TitleLine2: "Here's what we can do.",
  page1Subtitle: "Concrete, sourced levers — from individual habits to civic pressure.",

  transportTitle: "TRANSPORT",
  transportHeadline: "The top everyday source of emissions",
  transportText: "In France, transport is the largest source of greenhouse gas emissions — and driving alone accounts for more than half of it.",
  transportBars: [
    { label: "Driving alone", value: "218 g/km", percent: 100, colorVar: "coral" },
    { label: "Carpooling (4 people)", value: "55 g/km", percent: 25, colorVar: "amber" },
    { label: "Electric car", value: "~20 g/km", percent: 9, colorVar: "amber" },
    { label: "High-speed train", value: "~3 g/km", percent: 1.4, colorVar: "forest-medium" },
    { label: "Cycling / walking", value: "0 g/km", percent: 0, colorVar: "forest" }
  ],
  transportSource: "Direct emissions per kilometre and passenger, France. Source: ADEME Base Empreinte.",

  // Nuance l'intérêt de la voiture électrique selon l'intensité carbone
  // réelle du réseau électrique du pays (voir lib/gridIntensity.js).
  // "tier" vaut "low" | "medium" | "high" | null (donnée indisponible).
  gridNoteTransport: (countryName, tier) => {
    if (tier === "low") return `${countryName} has a largely decarbonised electricity grid: an electric car there genuinely cuts emissions, well beyond just driving comfort.`;
    if (tier === "medium") return `${countryName} has a moderately carbon-intensive grid: an electric car there is still a real improvement, though less dramatic than in a country with a very clean grid.`;
    if (tier === "high") return `${countryName} still has a largely carbon-intensive grid: the climate benefit of an electric car there is real, but will stay limited until electricity generation itself gets cleaner.`;
    return "This country's electricity mix isn't yet available in our data — we can't refine the local case for electric cars any further.";
  },

  logementTitle: "HOME",
  logementHeadline: "Insulation, heating, solar",
  logementMythLabel: "Common belief",
  logementMyth1: "\"Insulation is expensive and never pays for itself.\"",
  logementFactLabel: "In reality",
  logementFact1: "The upfront cost is usually paid back within a few years thanks to the heating savings made every winter — and public grants exist to lower that initial cost.",
  logementMyth2: "\"Solar is only worth it in very sunny countries.\"",
  logementFact2: "Solar panels produce electricity even in cloudy weather — several temperate-climate countries rank among the world's biggest solar producers.",

  gridNoteSolar: (countryName, tier) => {
    if (tier === "low") return `${countryName} already has a largely decarbonised grid: residential solar there is mostly about autonomy and bills, more than climate impact.`;
    if (tier === "medium") return `${countryName} has a moderately carbon-intensive grid: every kWh produced at home with solar there avoids a real share of emissions.`;
    if (tier === "high") return `${countryName} still has a largely carbon-intensive grid: residential solar there has a particularly clear climate impact, kWh for kWh.`;
    return "This country's electricity mix isn't yet available in our data — we can't refine the local case for electric cars any further.";
  },

  page2Eyebrow: "WATER & CIVIC ACTION",
  page2TitleLine1: "Simple habits.",
  page2TitleLine2: "A real collective weight.",
  page2Subtitle: "The water you save at home, and the lever no individual action replaces: public decisions.",

  eauTitle: "WATER",
  eauIntro: "A person in France uses 143 litres of drinking water a day on average. A few habits are enough to cut that figure with no real effort.",
  eauFacts: [
    { num: "100 L", label: "a 15-minute shower" },
    { num: "35 L", label: "the same shower in 5 minutes" },
    { num: "120 L/day", label: "wasted by a dripping tap" },
    { num: "600 L/day", label: "wasted by a leaking toilet" }
  ],
  eauSource: "Source: ADEME (agirpourlatransition.ademe.fr).",

  citoyenTitle: "CIVIC ACTION",
  citoyenHeadline: "The lever few sites give you",
  citoyenText: "Individual habits matter, but public decisions (public transport, energy renovation, forest protection) change the scale. This site already tracks your representatives and their votes — use it.",
  citoyenCta: "Find and follow my representative on pasdeplaneteb.com/deputes",

  closingTitle: "Understand. Compare. Act.",
  closingText: "Find all the data, sources and country-by-country comparisons.",
  sourcesGeneral: "Sources: ADEME • IPCC (AR5, electricity emission factors) • pasdeplaneteb.com",

  ogFallbackTitle: "Taking action on climate change, at our own scale",
  ogTagline: "Communication kit — taking action, sourced",

  page3Eyebrow: "TREES & CONSUMPTION",
  page3TitleLine1: "What we plant.",
  page3TitleLine2: "What we buy.",
  page3Subtitle: "Two levers where good intentions aren't always enough — what the data actually shows.",

  arbresTitle: "TREES & BIODIVERSITY",
  arbresHeadline: "Plant usefully, not just plant",
  arbresMythLabel: "Common belief",
  arbresMyth: "\"A fast-growing exotic tree captures CO2 faster, so it must be the best choice.\"",
  arbresFactLabel: "In reality",
  arbresFact: "Growth speed doesn't equal ecological value: a well-chosen native species stores carbon for decades, resists droughts and disease better, and feeds an entire ecosystem — while an exotic or invasive species can instead impoverish it. The right species choice shifts with climate change: check with your local forestry service rather than following a fixed list.",
  arbresQuestionsIntro: "Before planting: 4 questions to ask your nursery or local forestry service",
  arbresQuestions: [
    "Is this species native to my region, or at least well suited to its current climate?",
    "Is it flagged as invasive anywhere nearby?",
    "Are its water needs compatible with increasingly frequent droughts?",
    "Does the forestry service recommend \"assisted migration\" (planting today the species suited to tomorrow's climate) in my area?"
  ],
  arbresQuestionsWho: "These services update their recommendations every year as new drought data comes in — check with your local one before planting.",

  consoTitle: "CONSUMPTION",
  consoIndustryHeadline: "Heavy industry vs local shops: a matter of scale",
  consoIndustryText: "France's single biggest industrial site alone emits the equivalent of tens of thousands of small shops combined.",
  consoIndustryFacts: [
    { num: "8.5 Mt", label: "CO2/year — France's most emitting site (2024)" },
    { num: "~50-70 t", label: "CO2/year — order of magnitude, small bakery" },
    { num: "×120,000", label: "roughly, between the two" }
  ],
  consoIndustryNote: "This doesn't make individual habits pointless — but it explains why civic pressure on industrial and public decisions can weigh far more than an isolated consumer choice.",
  consoGardenHeadline: "Growing your own vegetables: it's mostly about how",
  consoGardenMythLabel: "What one might assume",
  consoGardenMyth: "\"Growing your own vegetables is necessarily more eco-friendly than buying them.\"",
  consoGardenFactLabel: "What research shows",
  consoGardenFact: "A study published in Landscape and Urban Planning (Cleveland et al., 2017) found that new vegetable gardens (bought raised beds, imported potting soil) can have a worse carbon footprint than conventional agriculture. The gain becomes real again by reusing existing materials and growing over several seasons, without buying new soil every year.",
  sourcesPage3: "Sources: Climate Action Network (industrial site rankings) • Cleveland et al., Landscape and Urban Planning, 2017 • pasdeplaneteb.com",
};
