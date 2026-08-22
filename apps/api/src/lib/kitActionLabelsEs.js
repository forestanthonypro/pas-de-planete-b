export const labelsActionEs = {
  lang: "es",

  page1Eyebrow: "ACTUAR A NUESTRA ESCALA",
  page1TitleLine1: "El diagnóstico está hecho.",
  page1TitleLine2: "Esto es lo que podemos hacer.",
  page1Subtitle: "Palancas concretas y sourced — del gesto individual a la presión ciudadana.",

  transportTitle: "TRANSPORTE",
  transportHeadline: "La primera fuente de emisiones del día a día",
  transportText: "En Francia, el transporte es la primera fuente de emisiones de gases de efecto invernadero — y el coche individual, usado en solitario, concentra más de la mitad.",
  transportBars: [
    { label: "Coche solo/a", value: "218 g/km", percent: 100, colorVar: "coral" },
    { label: "Coche compartido (4)", value: "55 g/km", percent: 25, colorVar: "amber" },
    { label: "Coche eléctrico", value: "~20 g/km", percent: 9, colorVar: "amber" },
    { label: "Tren de alta velocidad", value: "~3 g/km", percent: 1.4, colorVar: "forest-medium" },
    { label: "Bici / a pie", value: "0 g/km", percent: 0, colorVar: "forest" }
  ],
  transportSource: "Emisiones directas por kilómetro y pasajero, Francia. Fuente: Base Empreinte ADEME.",

  // Nuance l'intérêt de la voiture électrique selon l'intensité carbone
  // réelle du réseau électrique du pays (voir lib/gridIntensity.js).
  // "tier" vaut "low" | "medium" | "high" | null (donnée indisponible).
  gridNoteTransport: (countryName, tier) => {
    if (tier === "low") return `${countryName} tiene una red eléctrica ampliamente descarbonizada: un coche eléctrico allí reduce de verdad las emisiones, mucho más allá de la simple comodidad de conducción.`;
    if (tier === "medium") return `${countryName} tiene una red eléctrica de intensidad de carbono moderada: el coche eléctrico allí sigue siendo una mejora real, aunque menos radical que en un país con una red muy limpia.`;
    if (tier === "high") return `${countryName} tiene todavía una red eléctrica muy carbonizada: el beneficio climático del coche eléctrico allí es real, pero seguirá siendo limitado mientras la propia generación eléctrica no se descarbonice.`;
    return "El mix eléctrico de este país aún no está disponible en nuestros datos — no podemos matizar más el interés local del coche eléctrico.";
  },

  logementTitle: "VIVIENDA",
  logementHeadline: "Aislamiento, calefacción, solar",
  logementMythLabel: "Idea equivocada",
  logementMyth1: "«Aislar es caro y nunca se amortiza.»",
  logementFactLabel: "En realidad",
  logementFact1: "El sobrecoste inicial suele amortizarse en pocos años gracias al ahorro en calefacción cada invierno — y existen ayudas públicas para reducir ese coste de entrada.",
  logementMyth2: "«La energía solar solo compensa en países muy soleados.»",
  logementFact2: "Los paneles solares producen electricidad incluso con nubes — varios países de clima templado están entre los mayores productores de energía solar del mundo.",

  gridNoteSolar: (countryName, tier) => {
    if (tier === "low") return `${countryName} ya tiene una red eléctrica ampliamente descarbonizada: el interés del solar residencial allí es sobre todo cuestión de autonomía y factura, más que de clima.`;
    if (tier === "medium") return `${countryName} tiene una red eléctrica de intensidad de carbono moderada: cada kWh producido en casa con solar evita allí una parte real de emisiones.`;
    if (tier === "high") return `${countryName} tiene todavía una red eléctrica muy carbonizada: el solar residencial tiene allí un impacto climático especialmente claro, kWh por kWh.`;
    return "El mix eléctrico de este país aún no está disponible en nuestros datos — no podemos matizar más el interés local del coche eléctrico.";
  },

  page2Eyebrow: "AGUA Y ACCIÓN CIUDADANA",
  page2TitleLine1: "Gestos sencillos.",
  page2TitleLine2: "Un peso colectivo real.",
  page2Subtitle: "El agua que ahorras en casa, y la palanca que ningún gesto individual reemplaza: la decisión pública.",

  eauTitle: "AGUA",
  eauIntro: "Una persona en Francia consume en promedio 143 litros de agua potable al día. Bastan algunos hábitos para reducir esa cifra sin esfuerzo notable.",
  eauFacts: [
    { num: "100 L", label: "una ducha de 15 min" },
    { num: "35 L", label: "la misma ducha en 5 min" },
    { num: "120 L/día", label: "desperdiciados por un grifo que gotea" },
    { num: "600 L/día", label: "desperdiciados por una cisterna que pierde agua" }
  ],
  eauSource: "Fuente: ADEME (agirpourlatransition.ademe.fr).",

  citoyenTitle: "ACCIÓN CIUDADANA",
  citoyenHeadline: "La palanca que pocos sitios te dan",
  citoyenText: "Los gestos individuales cuentan, pero las decisiones públicas (transporte público, renovación energética, protección de bosques) cambian de escala. Este sitio ya sigue a tus representantes y sus votaciones — úsalo.",
  citoyenCta: "Encuentra y sigue a tu representante en pasdeplaneteb.com/deputes",

  closingTitle: "Comprender. Comparar. Actuar.",
  closingText: "Encuentra todos los datos, fuentes y comparaciones país por país.",
  sourcesGeneral: "Fuentes: ADEME • IPCC (AR5, factores de emisión eléctrica) • pasdeplaneteb.com",

  ogFallbackTitle: "Actuar contra el cambio climático, a nuestra escala",
  ogTagline: "Kit de comunicación — pasar a la acción, con fuentes",

  page3Eyebrow: "ÁRBOLES Y CONSUMO",
  page3TitleLine1: "Lo que plantamos.",
  page3TitleLine2: "Lo que compramos.",
  page3Subtitle: "Dos palancas donde la buena intención no siempre basta — lo que muestran realmente los datos.",

  arbresTitle: "ÁRBOLES Y BIODIVERSIDAD",
  arbresHeadline: "Plantar de forma útil, no solo plantar",
  arbresMythLabel: "Idea equivocada",
  arbresMyth: "«Un árbol exótico de crecimiento rápido captura CO2 más rápido, así que es la mejor opción.»",
  arbresFactLabel: "En realidad",
  arbresFact: "Velocidad de crecimiento no significa utilidad ecológica: una especie autóctona bien elegida almacena carbono durante décadas, resiste mejor las sequías y enfermedades, y alimenta todo un ecosistema — mientras que una especie exótica o invasora puede empobrecerlo. La elección correcta cambia con el cambio climático: consulta a tu servicio forestal local en vez de seguir una lista fija.",
  arbresQuestionsIntro: "Antes de plantar: 4 preguntas para hacerle a tu vivero o servicio forestal local",
  arbresQuestions: [
    "¿Esta especie es autóctona de mi región, o al menos está bien adaptada a su clima actual?",
    "¿Está señalada como invasora en algún lugar cercano?",
    "¿Sus necesidades de agua son compatibles con sequías cada vez más frecuentes?",
    "¿El servicio forestal recomienda una «migración asistida» (plantar hoy especies adaptadas al clima de mañana) en mi zona?"
  ],
  arbresQuestionsWho: "Estos servicios actualizan sus recomendaciones cada año con los nuevos datos de sequía — consulta al de tu zona antes de plantar.",

  consoTitle: "CONSUMO",
  consoIndustryHeadline: "Industria pesada vs comercio local: una cuestión de escala",
  consoIndustryText: "El mayor sitio industrial de Francia emite, él solo, el equivalente a decenas de miles de pequeños comercios juntos.",
  consoIndustryFacts: [
    { num: "8,5 Mt", label: "CO2/año — sitio más emisor de Francia (2024)" },
    { num: "~50-70 t", label: "CO2/año — orden de magnitud, panadería pequeña" },
    { num: "×120.000", label: "aproximadamente, entre ambos" }
  ],
  consoIndustryNote: "Esto no resta valor a los gestos individuales, pero explica por qué la presión ciudadana sobre las decisiones industriales y públicas puede pesar mucho más que una elección de consumo aislada.",
  consoGardenHeadline: "Cultivar tu propio huerto: depende sobre todo de cómo",
  consoGardenMythLabel: "Lo que se podría pensar",
  consoGardenMyth: "«Cultivar tus propias verduras es necesariamente más ecológico que comprarlas.»",
  consoGardenFactLabel: "Lo que muestra la investigación",
  consoGardenFact: "Un estudio publicado en Landscape and Urban Planning (Cleveland et al., 2017) muestra que un huerto nuevo (bancales comprados, tierra importada) puede tener una huella de carbono peor que la agricultura convencional. El beneficio vuelve a ser real reutilizando material existente y cultivando varias temporadas seguidas, sin comprar tierra nueva cada año.",
  sourcesPage3: "Fuentes: Réseau Action Climat (ranking de sitios industriales) • Cleveland et al., Landscape and Urban Planning, 2017 • pasdeplaneteb.com",
};
