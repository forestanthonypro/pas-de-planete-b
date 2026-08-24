export const labelsActionZh = {
  lang: "zh",

  page1Eyebrow: "从我做起",
  page1TitleLine1: "现状已经清楚。",
  page1TitleLine2: "以下是我们能做的事。",
  page1Subtitle: "具体、有据可查的行动杠杆——从个人习惯到公民推动。",

  transportTitle: "交通",
  transportHeadline: "日常生活中最大的排放来源",
  transportText: "在法国，交通是温室气体排放的首要来源——而独自开车出行占据了其中一半以上。",
  transportBars: [
    { label: "独自开车", value: "218 g/km", percent: 100, colorVar: "coral" },
    { label: "4人拼车", value: "55 g/km", percent: 25, colorVar: "amber" },
    { label: "电动车", value: "约20 g/km", percent: 9, colorVar: "amber" },
    { label: "高铁", value: "约3 g/km", percent: 1.4, colorVar: "forest-medium" },
    { label: "骑行/步行", value: "0 g/km", percent: 0, colorVar: "forest" }
  ],
  transportSource: "法国，每公里每位乘客的直接排放量。来源：ADEME Base Empreinte。",

  // Nuance l'intérêt de la voiture électrique selon l'intensité carbone
  // réelle du réseau électrique du pays (voir lib/gridIntensity.js).
  // "tier" vaut "low" | "medium" | "high" | null (donnée indisponible).
  gridNoteTransport: (countryName, tier) => {
    if (tier === "low") return `${countryName} 的电网已在很大程度上实现了低碳化：在这里，电动车真正能减少排放，而不仅仅是驾驶体验上的改善。`;
    if (tier === "medium") return `${countryName} 的电网碳强度处于中等水平：电动车在这里仍是切实的进步，只是不如电网非常清洁的国家那么明显。`;
    if (tier === "high") return `${countryName} 的电网碳强度仍然较高：电动车在这里对气候的益处是真实存在的，但在发电本身实现清洁化之前，效果将有限。`;
    return "该国的电力结构数据尚未纳入我们的数据库——因此无法进一步细化电动车在当地的实际意义。";
  },

  logementTitle: "住房",
  logementHeadline: "保温、供暖、太阳能",
  logementMythLabel: "常见误区",
  logementMyth1: "「做保温很贵，永远无法回本。」",
  logementFactLabel: "事实上",
  logementFact1: "初期额外投入通常能在几年内通过每年冬天节省的取暖费收回，而且还有不少公共补助可以降低这部分初始成本。",
  logementMyth2: "「太阳能只有在阳光非常充足的国家才划算。」",
  logementFact2: "太阳能板在多云天气下依然能发电，而多个温带气候国家正是全球最大的太阳能生产国之一。",

  gridNoteSolar: (countryName, tier) => {
    if (tier === "low") return `${countryName} 的电网已在很大程度上实现了低碳化：在这里，家用太阳能的意义更多在于自给自足和电费，而非气候影响。`;
    if (tier === "medium") return `${countryName} 的电网碳强度处于中等水平：在这里，家中太阳能每发一度电，都能实实在在地减少一部分排放。`;
    if (tier === "high") return `${countryName} 的电网碳强度仍然较高：在这里，家用太阳能每一度电对气候的影响都尤为显著。`;
    return "该国的电力结构数据尚未纳入我们的数据库——因此无法进一步细化电动车在当地的实际意义。";
  },

  page2Eyebrow: "节水与公民行动",
  page2TitleLine1: "简单的举动，",
  page2TitleLine2: "真正的集体力量。",
  page2Subtitle: "你在家节省的水，以及任何个人举动都无法替代的杠杆：公共决策。",

  eauTitle: "水",
  eauIntro: "法国人平均每天使用143升饮用水。只需几个简单习惯，就能在几乎不费力的情况下降低这个数字。",
  eauFacts: [
    { num: "100 升", label: "15分钟的淋浴" },
    { num: "35 升", label: "同样的淋浴缩短到5分钟" },
    { num: "120 升/天", label: "滴水的水龙头造成的浪费" },
    { num: "600 升/天", label: "漏水的马桶水箱造成的浪费" }
  ],
  eauSource: "来源：ADEME（agirpourlatransition.ademe.fr）。",

  citoyenTitle: "公民行动",
  citoyenHeadline: "很少有网站能提供的杠杆",
  citoyenText: "个人举动固然重要，但真正改变规模的是公共决策——公共交通、节能改造、森林保护。本网站已经在追踪你的议员及其投票记录——不妨善加利用。",
  citoyenCta: "在 pasdeplaneteb.com/deputes 查找并关注你的议员",

  closingTitle: "理解。比较。行动。",
  closingText: "查看所有数据、来源，以及各国之间的比较。",
  sourcesGeneral: "来源：ADEME · IPCC（AR5，电力排放因子）· pasdeplaneteb.com",

  ogFallbackTitle: "从我做起，应对气候变化",
  ogTagline: "行动传播工具包——有据可查",

  page3Eyebrow: "树木与消费",
  page3TitleLine1: "我们种下什么。",
  page3TitleLine2: "我们买了什么。",
  page3Subtitle: "两个仅凭良好意愿并不足够的领域——数据真正揭示的情况。",

  arbresTitle: "树木与生物多样性",
  arbresHeadline: "有意义地种树，而不只是种树",
  arbresMythLabel: "常见误区",
  arbresMyth: "「生长快的外来树种能更快吸收二氧化碳，所以是最佳选择。」",
  arbresFactLabel: "事实上",
  arbresFact: "生长速度并不等于生态价值：精心挑选的本地树种能在数十年间持续储存碳，更能抵御干旱和病害，并养育整个生态系统——而外来种或入侵种反而可能使其贫瘠化。合适树种的选择会随气候变化而改变：请咨询当地林业部门，而不是照搬固定清单。",
  arbresQuestionsIntro: "种植之前：向苗圃或当地林业部门提出的4个问题",
  arbresQuestions: [
    "这个树种是我所在地区的本地物种，或者至少很好地适应了当前的气候吗？",
    "它在附近是否被标记为入侵物种？",
    "它的需水量是否与日益频繁的干旱相适应？",
    "林业部门是否建议在我所在的地区进行「辅助迁移」（即今天就种植适应明天气候的树种）？"
  ],
  arbresQuestionsWho: "这些部门每年都会根据最新的干旱数据更新建议——种植前请咨询当地相关部门。",
  arbresGbifCta: "想知道您附近已经生长着哪些植物吗？可通过GlobalTreeSearch核实：pasdeplaneteb.com/vegetation",

  consoIndustryDynamicIntro: "真实的数据，而非孤立的比较",
  // countryName/year/pct fournis à l'appel (voir kitActionTemplate.js) —
  // year/pct viennent de sector_emissions (calcul réel), jamais inventés.
  consoIndustryDynamicText: (countryName, year, pct) => `在${countryName}（${year}年），工业过程排放（水泥、钢铁、化工等）占该国温室气体总排放量的${pct}%——其余来自能源、农业、废弃物处理和土地利用。`,
  consoIndustryFallbackPrefix: "该国数据暂不可用。作为参考，",
  consoIndustrySource: "来源：Climate Watch（世界资源研究所）。",

  sectorBreakdownTitle: "按部门划分的排放构成",
  sectorNames: {
    "Energy": "能源",
    "Industrial Processes": "工业过程",
    "Agriculture": "农业",
    "Waste": "废弃物",
    "Land-Use Change and Forestry": "土地利用与林业"
  },

  consoTitle: "消费",
  consoIndustryHeadline: "重工业与本地商店：规模问题",
  consoIndustryText: "法国最大的单一工业基地，其排放量相当于数万家小商店的总和。",
  consoIndustryFacts: [
    { num: "850万吨", label: "CO2/年——法国排放量最大的基地（2024年）" },
    { num: "约50-70吨", label: "CO2/年——小型面包店的大致数量级" },
    { num: "约12万倍", label: "两者之间的大致比例" }
  ],
  consoIndustryNote: "这并不意味着个人举动毫无意义——但它解释了为什么公民对工业和公共决策施加的压力，往往比单一的消费选择重要得多。",
  consoGardenHeadline: "种自家菜园：关键在于怎么做",
  consoGardenMythLabel: "人们可能会以为",
  consoGardenMyth: "「自己种菜必然比买菜更环保。」",
  consoGardenFactLabel: "研究显示",
  consoGardenFact: "发表在《Landscape and Urban Planning》上的一项研究（Cleveland等，2017年）发现，新建的菜园（购买的花坛、进口的培养土）碳足迹可能比传统农业更差。只有重复利用现有材料，并连续多个季节耕种、不必每年购买新培养土，收益才会真正显现。",
  sourcesPage3: "来源：Réseau Action Climat（工业基地排名）· Cleveland等，Landscape and Urban Planning，2017年 · pasdeplaneteb.com",
};
