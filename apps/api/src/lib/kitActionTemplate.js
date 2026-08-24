import { escapeHtml, formatNumber, CSS as BASE_CSS } from "./kitTemplate.js";

// Styles propres au kit "Actions" — s'appuient sur les variables de
// couleur déjà définies dans BASE_CSS (:root), sans les redéfinir.
const ACTION_CSS = `
  .bars { margin: 4mm 0 3mm; }
  .bar-row { display: grid; grid-template-columns: 42mm 1fr 20mm; align-items: center; gap: 3mm; margin-bottom: 2.5mm; }
  .bar-row .bar-label { font-size: 10px; font-weight: 700; color: var(--ink); }
  .bar-track { background: var(--line); border-radius: 3px; height: 5mm; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px 0 0 3px; }
  .bar-fill.coral { background: var(--coral); }
  .bar-fill.amber { background: var(--amber-fg, #854f0b); }
  .bar-fill.forest-medium { background: var(--forest-medium); }
  .bar-fill.forest { background: var(--forest); }
  .bar-fill.mauve { background: var(--mauve-fg, #5c3d7a); }
  .bar-fill.teal { background: var(--teal-fg, #0f6e56); }
  .bar-row .bar-value { font-size: 10px; font-weight: 700; color: var(--ink-light); text-align: right; }

  .myth-box { background: var(--amber-bg); border-radius: 8px; padding: 4mm 6mm; margin-bottom: 3mm; }
  .myth-box .lbl { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; color: var(--coral); margin: 0 0 1mm; }
  .myth-box .myth { font-size: 10.5px; font-style: italic; color: var(--ink); margin: 0 0 2mm; }
  .myth-box .fact-lbl { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; color: var(--forest); margin: 0 0 1mm; }
  .myth-box .fact { font-size: 10.5px; color: var(--ink); margin: 0; }

  .grid-note { background: var(--teal-bg); border-radius: 8px; padding: 3.5mm 6mm; font-size: 10px; color: var(--teal-fg); margin-bottom: 4mm; }

  .fact-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 4mm 0 3mm; }
  .fact-cell { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 3mm 2mm; text-align: center; }
  .fact-cell .num { display: block; font-size: 15px; font-weight: 800; color: var(--forest); margin-bottom: 0.5mm; }
  .fact-cell .lbl { display: block; font-size: 8px; color: var(--ink-light); }

  .action-source { font-size: 8.5px; color: var(--ink-light); margin: 0 0 5mm; }

  .questions-box { background: var(--teal-bg); border-radius: 8px; padding: 4mm 6mm; margin-bottom: 4mm; }
  .questions-intro { font-size: 10px; font-weight: 700; color: var(--teal-fg); margin: 0 0 2mm; }
  .questions-list { margin: 0 0 3mm; padding-left: 4mm; }
  .questions-list li { font-size: 10px; color: var(--ink); margin-bottom: 1.5mm; }

  .cta-box-action { background: var(--forest-dark); color: #fff; border-radius: 10px; padding: 6mm 8mm; margin-top: auto; }
  .cta-box-action .headline { font-size: 13px; font-weight: 800; margin: 0 0 2mm; }
  .cta-box-action .text { font-size: 10.5px; color: #cfd9c8; margin: 0 0 3mm; max-width: 150mm; }
  .cta-box-action .link { font-size: 10.5px; font-weight: 700; color: #fff; }

  .section-title { font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; color: var(--ink-light); text-transform: uppercase; margin: 0 0 1.5mm; }
  .section-headline { font-size: 17px; font-weight: 800; color: var(--ink); margin: 0 0 2.5mm; }

  @media screen and (max-width: 600px) {
    .fact-grid { grid-template-columns: repeat(2, 1fr); }
    .bar-row { grid-template-columns: 30mm 1fr 16mm; }
  }
`;

function renderBars(bars) {
  return `<div class="bars">${bars
    .map(
      (b) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(b.label)}</span>
      <div class="bar-track"><div class="bar-fill ${b.colorVar}" style="width:${Math.max(b.percent, 2)}%"></div></div>
      <span class="bar-value">${escapeHtml(b.value)}</span>
    </div>`
    )
    .join("")}</div>`;
}

function renderFactGrid(facts) {
  return `<div class="fact-grid">${facts
    .map(
      (f) => `
    <div class="fact-cell">
      <span class="num">${escapeHtml(f.num)}</span>
      <span class="lbl">${escapeHtml(f.label)}</span>
    </div>`
    )
    .join("")}</div>`;
}

function buildActionPage1Html(countryName, gridTier, labels, qrCodeDataUrl) {
  const safeCountryName = escapeHtml(countryName);
  const qrHtml = qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="QR" style="width:15mm;height:15mm;display:block" />` : `<div class="qr"></div>`;

  return `
<div class="page">
  <div class="topbar"><span>PAS DE PLANÈTE B</span><span class="right">${safeCountryName.toUpperCase()} • ${labels.page1Eyebrow}</span></div>
  <div class="content">
    <h1>${labels.page1TitleLine1}<span class="accent">${labels.page1TitleLine2}</span></h1>
    <p class="subtitle">${labels.page1Subtitle}</p>

    <p class="section-title">${labels.transportTitle}</p>
    <p class="section-headline">${labels.transportHeadline}</p>
    <p class="narrative" style="margin-bottom:3mm">${labels.transportText}</p>
    ${renderBars(labels.transportBars)}
    <p class="action-source">${labels.transportSource}</p>
    <div class="grid-note">${labels.gridNoteTransport(safeCountryName, gridTier)}</div>

    <p class="section-title" style="margin-top:2mm">${labels.logementTitle}</p>
    <p class="section-headline">${labels.logementHeadline}</p>
    <div class="myth-box">
      <p class="lbl">${labels.logementMythLabel}</p>
      <p class="myth">${labels.logementMyth1}</p>
      <p class="fact-lbl">${labels.logementFactLabel}</p>
      <p class="fact">${labels.logementFact1}</p>
    </div>
    <div class="myth-box">
      <p class="lbl">${labels.logementMythLabel}</p>
      <p class="myth">${labels.logementMyth2}</p>
      <p class="fact-lbl">${labels.logementFactLabel}</p>
      <p class="fact">${labels.logementFact2}</p>
    </div>
    <div class="grid-note">${labels.gridNoteSolar(safeCountryName, gridTier)}</div>
  </div>
  <div class="footer">
    <span>${labels.sourcesGeneral}</span>
    ${qrHtml}
  </div>
</div>`;
}

function buildActionPage2Html(countryName, labels) {
  const safeCountryName = escapeHtml(countryName);

  return `
<div class="page">
  <div class="topbar"><span>PAS DE PLANÈTE B</span><span class="right">${safeCountryName.toUpperCase()} • ${labels.page2Eyebrow}</span></div>
  <div class="content" style="padding-top:10mm">
    <h1 style="margin-top:0">${labels.page2TitleLine1}<span class="accent">${labels.page2TitleLine2}</span></h1>
    <p class="subtitle">${labels.page2Subtitle}</p>

    <p class="section-title">${labels.eauTitle}</p>
    <p class="narrative" style="margin-bottom:2mm">${labels.eauIntro}</p>
    ${renderFactGrid(labels.eauFacts)}
    <p class="action-source">${labels.eauSource}</p>

    <div class="cta-box-action">
      <p class="section-title" style="color:#a8d5a2; margin-bottom:2mm">${labels.citoyenTitle}</p>
      <p class="headline">${labels.citoyenHeadline}</p>
      <p class="text">${labels.citoyenText}</p>
      <p class="link">${labels.citoyenCta}</p>
    </div>
  </div>
  <div class="footer">
    <span>${labels.sourcesGeneral}</span>
  </div>
</div>`;
}

// countryName : nom déjà localisé (pas encore échappé — chaque fonction
// interne échappe elle-même au point d'insertion, comme dans
// kitTemplate.js, pour ne jamais échapper deux fois).
// gridTier : "low" | "medium" | "high" | null, voir lib/gridIntensity.js.
const SECTOR_COLORS = {
  "Energy": "coral",
  "Industrial Processes": "amber",
  "Agriculture": "forest-medium",
  "Waste": "mauve",
  "Land-Use Change and Forestry": "teal",
};

function renderSectorBars(breakdown, labels) {
  return `<div class="bars">${breakdown.sectors
    .map((s) => {
      const label = escapeHtml(labels.sectorNames[s.sector] || s.sector);
      const colorVar = SECTOR_COLORS[s.sector] || "forest";
      return `
    <div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill ${colorVar}" style="width:${Math.max(s.sharePct, 2)}%"></div></div>
      <span class="bar-value">${formatNumber(s.sharePct, 1)} %</span>
    </div>`;
    })
    .join("")}</div>`;
}

// industryBreakdown : { year, totalMtco2e, sectors: [...] } pour ce pays,
// ou null si absent — dans ce cas, repli automatique sur la France (elle
// aussi calculée en temps réel, jamais codée en dur), fournie séparément.
function buildActionPage3Html(countryName, labels, industryBreakdown, franceIndustryBreakdown) {
  const safeCountryName = escapeHtml(countryName);

  const breakdown = industryBreakdown || franceIndustryBreakdown;
  const breakdownIsFallback = !industryBreakdown && !!franceIndustryBreakdown;
  const industrial = breakdown ? breakdown.sectors.find((s) => s.sector === "Industrial Processes") : null;

  let industryShareHtml;
  if (industrial && !breakdownIsFallback) {
    industryShareHtml = labels.consoIndustryDynamicText(safeCountryName, breakdown.year, formatNumber(industrial.sharePct, 1));
  } else if (industrial && breakdownIsFallback) {
    const franceText = labels.consoIndustryDynamicText("France", breakdown.year, formatNumber(industrial.sharePct, 1));
    industryShareHtml = `${labels.consoIndustryFallbackPrefix} ${franceText}`;
  } else {
    industryShareHtml = labels.consoIndustryFallbackPrefix;
  }

  return `
<div class="page">
  <div class="topbar"><span>PAS DE PLANÈTE B</span><span class="right">${safeCountryName.toUpperCase()} • ${labels.page3Eyebrow}</span></div>
  <div class="content" style="padding-top:10mm">
    <h1 style="margin-top:0">${labels.page3TitleLine1}<span class="accent">${labels.page3TitleLine2}</span></h1>
    <p class="subtitle">${labels.page3Subtitle}</p>

    <p class="section-title">${labels.arbresTitle}</p>
    <p class="section-headline">${labels.arbresHeadline}</p>
    <div class="myth-box">
      <p class="lbl">${labels.arbresMythLabel}</p>
      <p class="myth">${labels.arbresMyth}</p>
      <p class="fact-lbl">${labels.arbresFactLabel}</p>
      <p class="fact">${labels.arbresFact}</p>
    </div>
    <div class="questions-box">
      <p class="questions-intro">${labels.arbresQuestionsIntro}</p>
      <ol class="questions-list">
        ${labels.arbresQuestions.map((q) => `<li>${q}</li>`).join("")}
      </ol>
      <p class="action-source" style="margin-bottom:0">${labels.arbresQuestionsWho}</p>
      <p class="action-source" style="margin-bottom:0;margin-top:1mm">${labels.arbresGbifCta}</p>
    </div>

    <p class="section-title" style="margin-top:3mm">${labels.consoTitle}</p>
    <p class="section-headline">${labels.consoIndustryDynamicIntro}</p>
    <p class="narrative" style="margin-bottom:2mm">${industryShareHtml}</p>
    ${breakdown ? `<p class="section-title" style="margin-top:0">${labels.sectorBreakdownTitle}${breakdownIsFallback ? " (France)" : ""}</p>${renderSectorBars(breakdown, labels)}` : ""}
    <p class="action-source" style="margin-bottom:3mm">${labels.consoIndustrySource}</p>

    <p class="section-headline" style="margin-top:2mm">${labels.consoGardenHeadline}</p>
    <div class="myth-box">
      <p class="lbl">${labels.consoGardenMythLabel}</p>
      <p class="myth">${labels.consoGardenMyth}</p>
      <p class="fact-lbl">${labels.consoGardenFactLabel}</p>
      <p class="fact">${labels.consoGardenFact}</p>
    </div>
  </div>
  <div class="footer">
    <span>${labels.sourcesPage3}</span>
  </div>
</div>`;
}

export function buildKitActionHtml(countryName, gridTier, labels, qrCodeDataUrl, industryBreakdown, franceIndustryBreakdown) {
  return `<!DOCTYPE html>
<html lang="${labels.lang || "fr"}">
<head>
<meta charset="UTF-8">
<title>Pas de planète B — ${escapeHtml(countryName)} — Agir</title>
<style>
  body { margin: 0; background: #fff; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  ${BASE_CSS}
  ${ACTION_CSS}
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
${buildActionPage1Html(countryName, gridTier, labels, qrCodeDataUrl)}
${buildActionPage2Html(countryName, labels)}
${buildActionPage3Html(countryName, labels, industryBreakdown, franceIndustryBreakdown)}
</body>
</html>`;
}
