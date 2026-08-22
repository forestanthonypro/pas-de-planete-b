export const labelsActionJa = {
  lang: "ja",

  page1Eyebrow: "自分にできる行動",
  page1TitleLine1: "現状はもう分かった。",
  page1TitleLine2: "次にできることがこれです。",
  page1Subtitle: "個人の習慣から市民の声まで、具体的で出典のある手段を。",

  transportTitle: "交通",
  transportHeadline: "日常生活で最大の排出源",
  transportText: "フランスでは交通が温室効果ガス排出の最大の要因であり、一人で運転する自家用車がその半分以上を占めます。",
  transportBars: [
    { label: "一人で車", value: "218 g/km", percent: 100, colorVar: "coral" },
    { label: "4人で車をシェア", value: "55 g/km", percent: 25, colorVar: "amber" },
    { label: "電気自動車", value: "約20 g/km", percent: 9, colorVar: "amber" },
    { label: "高速鉄道", value: "約3 g/km", percent: 1.4, colorVar: "forest-medium" },
    { label: "自転車・徒歩", value: "0 g/km", percent: 0, colorVar: "forest" }
  ],
  transportSource: "1kmあたり・乗客1人あたりの直接排出量、フランス。出典：ADEME Base Empreinte。",

  // Nuance l'intérêt de la voiture électrique selon l'intensité carbone
  // réelle du réseau électrique du pays (voir lib/gridIntensity.js).
  // "tier" vaut "low" | "medium" | "high" | null (donnée indisponible).
  gridNoteTransport: (countryName, tier) => {
    if (tier === "low") return `${countryName} は電力網の大部分がすでに脱炭素化されており、電気自動車は運転の快適さ以上に、実際に排出量を大きく減らします。`;
    if (tier === "medium") return `${countryName} は電力網の炭素強度が中程度であり、電気自動車は依然として真の改善ですが、非常にクリーンな電力網を持つ国ほど劇的ではありません。`;
    if (tier === "high") return `${countryName} は依然として炭素集約度の高い電力網を持っており、電気自動車の気候面での利点は本物ですが、発電自体がクリーンになるまでは限定的なままです。`;
    return "この国の電源構成データはまだありません。電気自動車の現地での意義をこれ以上詳しく説明することはできません。";
  },

  logementTitle: "住まい",
  logementHeadline: "断熱・暖房・太陽光",
  logementMythLabel: "よくある誤解",
  logementMyth1: "「断熱はお金がかかり、決して元が取れない。」",
  logementFactLabel: "実際には",
  logementFact1: "初期費用は、毎冬の暖房費の節約によって数年で回収できることがほとんどです。また、その初期費用を抑えるための公的助成金もあります。",
  logementMyth2: "「太陽光発電は、とても日当たりの良い国でしか意味がない。」",
  logementFact2: "太陽光パネルは曇りの日でも発電しますし、温暖な気候のいくつかの国は世界有数の太陽光発電国です。",

  gridNoteSolar: (countryName, tier) => {
    if (tier === "low") return `${countryName} はすでに電力網の大部分が脱炭素化されており、家庭用太陽光発電の意義は気候面よりも自給率や電気代の面が大きいといえます。`;
    if (tier === "medium") return `${countryName} は電力網の炭素強度が中程度であり、自宅の太陽光で発電する1kWhごとに実質的な排出削減につながります。`;
    if (tier === "high") return `${countryName} は依然として炭素集約度の高い電力網を持っており、家庭用太陽光発電は1kWhあたりの気候への影響が特に明確です。`;
    return "この国の電源構成データはまだありません。電気自動車の現地での意義をこれ以上詳しく説明することはできません。";
  },

  page2Eyebrow: "水と市民の行動",
  page2TitleLine1: "簡単な習慣が、",
  page2TitleLine2: "本当に大きな力になる。",
  page2Subtitle: "家庭で節約する水と、個人の行動だけでは代えられない力――公共の意思決定。",

  eauTitle: "水",
  eauIntro: "フランス人は平均して1日143リットルの飲料水を使用しています。いくつかの習慣を変えるだけで、大きな負担なくこの数字を減らせます。",
  eauFacts: [
    { num: "100 L", label: "15分間のシャワー" },
    { num: "35 L", label: "同じシャワーを5分間に短縮" },
    { num: "120 L/日", label: "水漏れする蛇口による無駄" },
    { num: "600 L/日", label: "水漏れするトイレタンクによる無駄" }
  ],
  eauSource: "出典：ADEME（agirpourlatransition.ademe.fr）。",

  citoyenTitle: "市民の行動",
  citoyenHeadline: "ほとんどのサイトにはない手段",
  citoyenText: "個人の行動も大切ですが、公共交通機関、省エネ改修、森林保護といった公共の意思決定こそが規模を変えます。このサイトはすでにあなたの議員とその投票を追跡しています——ぜひ活用してください。",
  citoyenCta: "pasdeplaneteb.com/deputes で自分の議員を見つけてフォローする",

  closingTitle: "理解する。比較する。行動する。",
  closingText: "すべてのデータ、出典、国ごとの比較をご覧いただけます。",
  sourcesGeneral: "出典：ADEME・IPCC（AR5、電力排出係数）・pasdeplaneteb.com",

  ogFallbackTitle: "自分にできる規模で気候変動に対処する",
  ogTagline: "コミュニケーションキット――行動へ、出典付きで",

  page3Eyebrow: "樹木と消費",
  page3TitleLine1: "何を植えるか。",
  page3TitleLine2: "何を買うか。",
  page3Subtitle: "善意だけでは十分でないことがある2つの分野――データが実際に示すもの。",

  arbresTitle: "樹木と生物多様性",
  arbresHeadline: "ただ植えるのではなく、役立つように植える",
  arbresMythLabel: "よくある誤解",
  arbresMyth: "「成長の早いエキゾチックな木のほうがCO2を早く吸収するから、最良の選択のはず。」",
  arbresFactLabel: "実際には",
  arbresFact: "成長の速さは生態的な有用性を意味しません。適切に選ばれた在来種は数十年にわたって炭素を蓄え、干ばつや病気により強く、生態系全体を養います――一方で外来種や侵略的な種は、逆に生態系を貧しくすることがあります。適切な樹種の選択は気候変動とともに変化します。固定リストに従うのではなく、地域の林業サービスに相談してください。",
  arbresQuestionsIntro: "植える前に：苗木業者や地域の林業サービスに聞くべき4つの質問",
  arbresQuestions: [
    "この樹種は自分の地域originのものか、少なくとも現在の気候によく適応していますか？",
    "近隣のどこかで侵略的種として報告されていませんか？",
    "ますます頻繁になる干ばつに見合った水分要求量ですか？",
    "林業サービスは、私の地域で「支援移住」（明日の気候に適した樹種を今日から植えること）を推奨していますか？"
  ],
  arbresQuestionsWho: "こうしたサービスは、新しい干ばつデータが得られるたびに毎年推奨内容を更新しています——植える前に地域の窓口に確認してください。",

  consoTitle: "消費",
  consoIndustryHeadline: "重工業と地元商店――規模の問題",
  consoIndustryText: "フランス最大の産業施設ひとつだけで、数万の小規模店舗を合わせたのと同じ量を排出しています。",
  consoIndustryFacts: [
    { num: "850万トン", label: "CO2/年――フランスで最も排出量が多い施設（2024年）" },
    { num: "約50〜70トン", label: "CO2/年――小規模パン屋のおおよその目安" },
    { num: "約12万倍", label: "両者のおおよその差" }
  ],
  consoIndustryNote: "これは個人の習慣を無意味にするものではありません――ただ、産業・公共の意思決定への市民の働きかけが、個々の消費選択よりもはるかに大きな意味を持つ理由を説明しています。",
  consoGardenHeadline: "家庭菜園を育てる――重要なのはやり方",
  consoGardenMythLabel: "思われがちなこと",
  consoGardenMyth: "「自分で野菜を育てることは、買うよりも必ず環境に良い。」",
  consoGardenFactLabel: "研究が示すこと",
  consoGardenFact: "Landscape and Urban Planning誌に掲載された研究（Cleveland他、2017年）では、新しい家庭菜園（購入した花壇、輸入した培養土）が従来の農業よりも悪い炭素排出量になり得ることが示されています。既存の材料を再利用し、毎年新しい培養土を買わずに複数シーズン栽培を続けることで、その利点は本物になります。",
  sourcesPage3: "出典：Réseau Action Climat（産業施設ランキング）・Cleveland他、Landscape and Urban Planning、2017年・pasdeplaneteb.com",
};
