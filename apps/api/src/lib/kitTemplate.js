import { buildWarmingStripes } from "./kitWarmingStripes.js";

// Échappement HTML centralisé — suite à l'audit de sécurité du 20 août
// 2026, qui a trouvé un vrai point d'injection exploitable sans
// authentification : countryName vient de localizeCountryName(country,
// lang), où "country" est le paramètre d'URL brut (route
// /api/kit-communication/html/:code) — si le code ne correspond à aucun
// pays connu, la fonction retombe sur ce paramètre brut, non filtré,
// injecté ensuite tel quel à plusieurs endroits de ce gabarit. Un lien du
// type pasdeplaneteb.com/kit-communication/<script>... exécutait alors du
// JavaScript arbitraire, sans connexion admin requise — bien plus grave
// que le contenu légal (qui exige un accès admin compromis). Toutes les
// chaînes assemblées dans ce fichier passent maintenant par cette
// fonction, y compris celles jugées sûres aujourd'hui (noms de pays venant
// de la base) — coût nul, protège aussi contre une source qui deviendrait
// un jour moins fiable sans qu'on y pense.
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CSS = `

  :root {
    --forest: #1b5e20;
    --forest-dark: #0f3d12;
    --forest-medium: #639922;
    --coral: #d85a30;
    --coral-bg: #fbe4da;
    --blue-bg: #e3eef7; --blue-fg: #0b3c5d;
    --amber-bg: #faeeda; --amber-fg: #854f0b;
    --teal-bg: #dcf2ee; --teal-fg: #0f6e56;
    --mauve-bg: #ece5f2; --mauve-fg: #5c3d7a;
    --cream: #f4f1e8;
    --ink: #1c1c18;
    --ink-light: #5c5b52;
    --line: #ddd9c8;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #cfcdc0;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--ink); padding: 24px 0 60px;
  }
  .label { text-align: center; font-size: 13px; color: #4a493f; margin: 0 0 10px; font-weight: 700; }
  .page {
    width: 100%; max-width: 210mm; margin: 0 auto 40px;
    background: var(--cream); box-shadow: 0 4px 24px rgba(0,0,0,0.2);
    display: flex; flex-direction: column;
  }
  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10mm 16mm 0; font-size: 10.5px; letter-spacing: 0.04em; font-weight: 700; color: var(--forest);
  }
  .topbar .right { color: var(--ink-light); font-weight: 600; }
  .content { padding: 4mm 16mm 0; flex: 1; display: flex; flex-direction: column; }
  h1 { font-size: 32px; font-weight: 800; line-height: 1.12; margin: 6mm 0 0; }
  h1 .accent { color: var(--forest); display: block; }
  .subtitle { font-size: 12.5px; color: var(--ink-light); margin: 5mm 0 8mm; max-width: 150mm; }

  .number-pair { display: flex; gap: 12mm; margin-bottom: 8mm; }
  .number-block { flex: 1; }
  .number-block .eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: var(--ink-light); margin: 0 0 2mm; }
  .number-block .num { font-size: 40px; font-weight: 800; margin: 0; line-height: 1; }
  .number-block.fr .num { color: var(--forest); }
  .number-block.world .num { color: var(--ink-light); }
  .number-block .note { font-size: 10.5px; color: var(--ink-light); margin: 2mm 0 0; }

  .signature-box {
    background: var(--forest-dark); color: #fff; border-radius: 12px;
    padding: 6mm 10mm; margin-bottom: 4mm;
  }
  .signature-box .tag { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: #a8d5a2; margin: 0 0 3mm; }
  .signature-box .headline { font-size: 19px; font-weight: 800; margin: 0 0 3mm; line-height: 1.2; }
  .signature-box .detail { font-size: 11.5px; opacity: 0.92; margin: 0; max-width: 145mm; }
  .split-bar { display: flex; height: 7mm; border-radius: 4px; overflow: hidden; margin: 5mm 0 2mm; }
  .split-bar .old { background: rgba(255,255,255,0.25); }
  .split-bar .new { background: var(--coral); }
  .split-labels { display: flex; justify-content: space-between; font-size: 9.5px; opacity: 0.85; }

  .range-list { margin-bottom: 4mm; }
  .range-row { padding: 1.5mm 0; border-bottom: 2.5px solid var(--forest); }
  .range-row .rr-name { font-size: 10.5px; font-weight: 700; color: var(--ink); margin: 0 0 1.3mm; display: block; }

  .cc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5mm; margin-bottom: 1.5mm; }
  .cc-cell { border-radius: 6px; padding: 1.3mm 2mm; text-align: center; }
  .cc-cell .cc-country { display: block; font-size: 8px; margin-bottom: 0.5mm; }
  .cc-cell .cc-value { display: block; font-size: 12px; font-weight: 800; }
  .cc-cell.best { background: #eaf3de; color: #3d5c1f; }
  .cc-cell.avg { background: #fff; border: 1px solid var(--line); color: var(--ink-light); }
  .cc-cell.france { background: var(--forest); color: #fff; }
  .cc-cell.worst { background: var(--coral-bg); color: #8a3d22; }

  .range-row .rr-wrap { position: relative; padding-top: 1mm; margin-bottom: 0; }
  .range-row .rr-track { position: relative; height: 5mm; border-radius: 3px;
    background: linear-gradient(to right, #639922, #ef9f27, #d85a30); }
  .range-row .rr-dot-france { position: absolute; top: 50%; width: 4.5mm; height: 4.5mm; border-radius: 50%;
    background: #fff; border: 2.5px solid var(--ink); transform: translate(-50%, -50%); }
  .range-row .rr-bar-avg-svg { position: absolute; top: -1.5mm; width: 7px; height: 8mm; overflow: visible; }
  .rr-legend { font-size: 8.5px; color: var(--ink-light); margin-top: 4mm; display: flex; align-items: center; gap: 2mm; }
  .rr-subnote { font-size: 9px; color: var(--ink-light); font-style: italic; margin: 0 0 1mm; }
  .legend-dot { display: inline-block; width: 4mm; height: 4mm; border-radius: 50%; background: #fff; border: 2px solid var(--ink); flex-shrink: 0; }
  .legend-bar { display: inline-block; width: 1.5px; height: 5mm; background: var(--ink); flex-shrink: 0; margin-left: 2mm; }

  .stripe-band { display: flex; height: 15mm; }
  .stripe-band div { flex: 1; }

  .footer {
    background: #e8e4d3; border-top: 1px solid var(--line);
    padding: 5mm 16mm; display: flex; justify-content: space-between; align-items: center;
    font-size: 9.5px; color: var(--ink-light); margin-top: auto;
  }
  .qr { width: 15mm; height: 15mm; background: repeating-linear-gradient(45deg,#333 0 2px,#fff 2px 4px); border: 1px solid #333; }

  .retenir { background: #ece8d8; border-left: 3px solid var(--forest); padding: 4.5mm 8mm; font-size: 11.5px; margin-bottom: 6mm; margin-top: auto; }
  .retenir b { color: var(--forest); }

  .narrative { font-size: 11px; line-height: 1.5; color: var(--ink); max-width: 155mm; margin-bottom: 4mm; }

  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; margin-bottom: 8mm; }

  .energy-title { font-size: 12px; font-weight: 700; color: var(--ink-light); letter-spacing: 0.03em; margin: 0 0 3mm; }
  .energy-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-bottom: 4mm; }
  .energy-card { border-radius: 10px; padding: 5mm 3mm; text-align: center; }
  .energy-card svg { width: 7mm; height: 7mm; margin-bottom: 2mm; }
  .energy-card .en-name { font-size: 10.5px; font-weight: 700; margin: 0 0 1mm; }
  .energy-card .en-pct { font-size: 22px; font-weight: 800; margin: 0; }
  .energy-card.nuclear { background: var(--teal-bg); color: var(--teal-fg); }
  .energy-card.hydro { background: var(--blue-bg); color: var(--blue-fg); }
  .energy-card.gas { background: var(--amber-bg); color: var(--amber-fg); }
  .stat-card { border-radius: 10px; padding: 7mm 6mm; }
  .stat-card .val { font-size: 20px; font-weight: 800; margin: 0 0 1mm; }
  .stat-card .lbl { font-size: 10px; margin: 0; opacity: 0.85; }

  .closing-box {
    background: #e8e2c9; border-radius: 10px; padding: 4mm 8mm;
    display: flex; justify-content: space-between; align-items: center; gap: 8mm;
    margin-top: auto; margin-bottom: 3mm;
  }
  .closing-box .text b { display: block; font-size: 13px; color: var(--forest); margin-bottom: 2mm; }
  .closing-box .text span { font-size: 11px; color: var(--ink-light); }

  /* Règles spécifiques à l'impression PDF — les marges/ombres ci-dessus
     ne servaient qu'à séparer visuellement les pages dans un aperçu
     navigateur en défilement. En impression, elles ajoutent de la hauteur
     en trop et créent une page 3 quasi vide (bug rencontré et corrigé
     lors des tests Phase 3). */
  /* Règles spécifiques à l'impression PDF — .page est fluide par défaut
     (lecture confortable à l'écran, cf. section "aperçu web responsive"
     plus bas), les dimensions A4 fixes ne s'appliquent qu'ici. Les
     marges/ombres de la version écran ajouteraient de la hauteur en trop
     à l'impression et créeraient une page 3 quasi vide (bug rencontré et
     corrigé lors des tests Phase 3). */
  @media print {
    body { padding: 0; background: #fff; }
    .page { width: 210mm; height: 297mm; max-width: none; margin: 0; box-shadow: none; overflow: hidden; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    .label { display: none; }
  }

  /* Aperçu web responsive — .page garde ses proportions A4 (max-width)
     sur grand écran, mais les grilles à 4/3 colonnes (denses même en
     format A4) deviennent illisibles sur mobile si on ne fait que
     rétrécir le conteneur : les colonnes s'écrasent au lieu de
     s'empiler. On les réorganise explicitement en dessous d'un certain
     seuil plutôt que de laisser le rétrécissement pur créer du texte
     minuscule. */
  @media screen and (max-width: 600px) {
    body { padding: 12px 0 30px; }
    .page { box-shadow: 0 2px 10px rgba(0,0,0,0.15); margin-bottom: 20px; }
    h1 { font-size: 24px; }
    .number-pair { flex-direction: column; gap: 4mm; }
    .cc-grid { grid-template-columns: repeat(2, 1fr); }
    .energy-grid { grid-template-columns: repeat(2, 1fr); }
    .signature-box .headline { font-size: 16px; }
    .range-row .rr-name { font-size: 10px; }
  }
`;



// --- Icônes des filières énergétiques (SVG en ligne, style trait épuré,
// cohérent avec le reste du site) — couvre toutes les clés possibles
// renvoyées par ENERGY_SOURCES côté API, pas seulement les 3 de la France.
const ENERGY_ICON_PATHS = {
  nuclear: `<circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>
    <ellipse cx="12" cy="12" rx="10" ry="4"/>
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/>
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>`,
  hydro: `<path d="M12 2c4 5 7 9 7 13a7 7 0 0 1-14 0c0-4 3-8 7-13Z"/>`,
  gas: `<path d="M12 2c-1 3-4 4-4 8a4 4 0 0 0 8 0c0-1.5-1-2.5-1-2.5s-.5 1.5-2 1.5c-1 0-1.5-1-1.5-2 0-2 2-3 2-5Z"/>
    <path d="M8 14a4 4 0 0 0 8 0"/>`,
  coal: `<path d="M4 16c0-3 2-5 4-6 1-3 4-5 6-4 3-1 6 1 6 4 2 1 3 3 3 5 0 3-3 5-6 5H8c-2 0-4-2-4-4Z"/>`,
  wind: `<circle cx="12" cy="7" r="1.3" fill="currentColor" stroke="none"/>
    <path d="M12 7 L12 21"/>
    <path d="M12 7 L18 4"/>
    <path d="M12 7 L7 3"/>
    <path d="M12 7 L9 14"/>`,
  solar: `<circle cx="12" cy="12" r="4"/>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2"/>`,
  oil: `<rect x="6" y="4" width="12" height="16" rx="2"/>
    <path d="M6 9h12M6 15h12"/>`,
  biofuel: `<path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14Z"/>
    <path d="M5 19c0-4 3-7 7-9"/>`,
  other: `<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8Z"/>`,
};

function renderIcon(key) {
  const inner = ENERGY_ICON_PATHS[key] || ENERGY_ICON_PATHS.other;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${inner}</svg>`;
}

const ENERGY_TINT_CLASS = {
  nuclear: "nuclear",
  hydro: "hydro",
  gas: "gas",
  coal: "gas",
  wind: "hydro",
  solar: "gas",
  oil: "gas",
  biofuel: "hydro",
  other: "nuclear",
};

function formatNumber(value, decimals) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function renderEnergyCards(energyTop3, labels) {
  if (!energyTop3 || energyTop3.length === 0) {
    return `<p class="rr-subnote">${labels.energyUnavailable}</p>`;
  }
  const cards = energyTop3
    .map(
      (s) => `
      <div class="energy-card ${ENERGY_TINT_CLASS[s.icon] || "gas"}">
        ${renderIcon(s.icon)}
        <p class="en-name">${labels.energySources[s.icon] || s.icon}</p>
        <p class="en-pct">${s.share !== null ? formatNumber(s.share, 0) + " %" : "—"}</p>
      </div>`
    )
    .join("");

  const totalShare = energyTop3.reduce((sum, s) => sum + (s.share || 0), 0);
  const rest = Math.max(0, Math.round(100 - totalShare));
  const restHtml = rest > 0 ? `<p class="rr-subnote">${labels.energyRest(rest)}</p>` : "";

  return `<div class="energy-grid">${cards}</div>${restHtml}`;
}

function renderWarmingStripesHtml(history) {
  const bands = buildWarmingStripes(history, 5);
  if (bands.length === 0) return "";
  return `<div class="stripe-band">${bands.map((b) => `<div style="background:${b.color}"></div>`).join("")}</div>`;
}

// Un des 6 indicateurs comparatifs — tableau à 4 cases (dans l'ordre déjà
// calculé côté API par buildComparisonRow) + barre de position en dessous.
function renderComparisonRow(row, labels, countryName) {
  if (!row || row.orderedEntries.length === 0) return "";

  const cellHtml = (entry) => {
    const name = entry.role === "france" ? countryName : entry.role === "avg" ? labels.world : entry.name;
    const mergedNote = entry.mergedRoles && entry.mergedRoles.includes("france") && entry.role !== "france" ? "" : "";
    return `
      <div class="cc-cell ${entry.role}">
        <span class="cc-country">${escapeHtml(name)}${mergedNote}</span>
        <span class="cc-value">${formatNumber(entry.value, row.decimals)}${row.unit ? " " + row.unit : ""}</span>
      </div>`;
  };

  const barHtml =
    row.francePosition !== null || row.avgPosition !== null
      ? `<div class="rr-wrap">
          <div class="rr-track">
            ${row.avgPosition !== null ? `<svg class="rr-bar-avg-svg" style="left:${row.avgPosition}%;transform:translateX(-3.5px)" viewBox="0 0 7 100" preserveAspectRatio="none"><rect x="0" y="0" width="7" height="100" style="fill:var(--ink)" shape-rendering="crispEdges" /></svg>` : ""}
            ${row.francePosition !== null ? `<div class="rr-dot-france" style="left:${row.francePosition}%"></div>` : ""}
          </div>
        </div>`
      : "";

  const subnote = row.labelKey === "eau" ? `<p class="rr-subnote" style="margin-top:2mm">${labels.eauSubnote}</p>` : "";

  return `
    <div class="range-row">
      <span class="rr-name">${labels.indicators[row.labelKey]}</span>
      <div class="cc-grid">${row.orderedEntries.map(cellHtml).join("")}</div>
      ${barHtml}
      ${subnote}
    </div>`;
}

function buildPage1Html(data, countryName, labels, qrCodeDataUrl) {
  const safeCountryName = escapeHtml(countryName);
  const worldTemp = data.worldTemperatureDeviation;
  const franceTemp = data.temperatureDeviation;
  const hasHeatwaveData = data.heatwaves && (data.heatwaves.recent > 0 || data.heatwaves.past > 0);
  const heatwaveRatio = hasHeatwaveData && data.heatwaves.past > 0 ? (data.heatwaves.recent / data.heatwaves.past) : null;
  const heatwaveRatioDisplay = heatwaveRatio !== null ? (Number.isInteger(heatwaveRatio) ? String(heatwaveRatio) : heatwaveRatio.toFixed(1)) : null;
  const qrHtml = qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="QR" style="width:15mm;height:15mm;display:block" />` : `<div class="qr"></div>`;

  let worldTempNoteHtml = "";
  if (franceTemp !== null && worldTemp !== null && worldTemp !== 0) {
    const rawRatio = franceTemp / worldTemp;
    const faster = rawRatio >= 1;
    const displayRatio = formatNumber(faster ? rawRatio : 1 / rawRatio, 1);
    worldTempNoteHtml = `<p class="note">${labels.worldTempNote(displayRatio, faster, safeCountryName)}</p>`;
  }

  return `
<div class="page">
  <div class="topbar"><span>PAS DE PLANÈTE B</span><span class="right">${safeCountryName.toUpperCase()} • ${labels.page1Eyebrow}</span></div>
  ${data.temperatureHistory && data.temperatureHistory.length > 0 ? renderWarmingStripesHtml(data.temperatureHistory) : ""}
  <div class="content">
    <h1>${labels.page1TitleLine1}<span class="accent">${labels.page1TitleLine2}</span></h1>
    <p class="subtitle">${labels.page1Subtitle}</p>

    <div class="number-pair">
      <div class="number-block fr">
        <p class="eyebrow">${safeCountryName.toUpperCase()} • ${labels.referenceLabel}</p>
        <p class="num">${franceTemp !== null ? (franceTemp > 0 ? "+" : "") + formatNumber(franceTemp, 2) + " °C" : "—"}</p>
        <p class="note">${labels.franceTempNote}</p>
      </div>
      <div class="number-block world">
        <p class="eyebrow">${labels.world.toUpperCase()} • ${labels.samePeriod}</p>
        <p class="num">${worldTemp !== null ? (worldTemp > 0 ? "+" : "") + formatNumber(worldTemp, 2) + " °C" : "—"}</p>
        ${worldTempNoteHtml}
      </div>
    </div>

    ${
      hasHeatwaveData
        ? `<div class="signature-box">
      <p class="tag">${labels.heatwaveTag}</p>
      <p class="headline">${labels.heatwaveHeadline(heatwaveRatioDisplay)}</p>
      <p class="detail">${labels.heatwaveDetail}</p>
      <div class="split-bar">
        <div class="old" style="flex:${data.heatwaves.past || 1}"></div>
        <div class="new" style="flex:${data.heatwaves.recent || 1}"></div>
      </div>
      <div class="split-labels"><span>${data.heatwaves.past} ${labels.wavesLabel} • 1956-1990</span><span>${data.heatwaves.recent} ${labels.wavesLabel} • 1991-2025</span></div>
    </div>
    <p class="narrative">${labels.heatwaveNarrative}</p>`
        : ""
    }

    ${data.energyTop3 && data.energyTop3.length > 0 ? `<p class="energy-title">${labels.energyTitle(safeCountryName)}</p>${renderEnergyCards(data.energyTop3, labels)}` : ""}

    <div class="retenir"><b>${labels.retenirLabel} —</b> ${labels.retenirText}</div>
  </div>
  <div class="footer">
    <span>${labels.sourcesTemperature}</span>
    ${qrHtml}
  </div>
</div>`;
}

function buildPage2Html(data, countryName, labels, qrCodeDataUrl) {
  const safeCountryName = escapeHtml(countryName);
  const rows = ["co2", "electricite", "eau", "foret", "pollution", "especes"];
  // countryName brut (pas safeCountryName) transmis ici : renderComparisonRow
  // échappe déjà en interne au point d'insertion réel — l'échapper aussi
  // ici doublerait l'échappement (ex: & -> &amp; -> &amp;amp;).
  const rowsHtml = rows.map((key) => renderComparisonRow(data.comparisons[key], labels, countryName)).join("");
  const qrHtml = qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="QR" style="width:15mm;height:15mm;display:block" />` : `<div class="qr"></div>`;

  return `
<div class="page">
  <div class="topbar"><span>PAS DE PLANÈTE B</span><span class="right">${safeCountryName.toUpperCase()} • ${labels.page2Eyebrow}</span></div>
  <div class="content" style="padding-top:10mm">
    <h1 style="margin-top:0">${labels.page2TitleLine1}<span class="accent">${labels.page2TitleLine2}</span></h1>
    <p class="subtitle">${labels.page2Subtitle}</p>

    <div class="range-list">${rowsHtml}</div>
    <p class="rr-legend"><span class="legend-dot"></span> ${labels.legendFrance(safeCountryName)} <span class="legend-bar"></span> ${labels.legendWorld}</p>

    <p class="narrative" style="margin-top:5mm">${labels.narrativeCaveat}</p>

    <div class="closing-box">
      <div class="text">
        <b>${labels.closingTitle}</b>
        <span>${labels.closingText}</span>
      </div>
      ${qrHtml}
    </div>
  </div>
  <div class="footer">
    <span>${labels.sourcesGeneral}</span>
  </div>
</div>`;
}

function buildKitHtml(data, countryName, labels, qrCodeDataUrl) {
  return `<!DOCTYPE html>
<html lang="${labels.lang || "fr"}">
<head>
<meta charset="UTF-8">
<title>Pas de planète B — ${escapeHtml(countryName)}</title>
<style>
  body { margin: 0; background: #fff; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  ${CSS}
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
${buildPage1Html(data, countryName, labels, qrCodeDataUrl)}
${buildPage2Html(data, countryName, labels, qrCodeDataUrl)}
</body>
</html>`;
}



export { buildKitHtml, formatNumber, renderIcon, escapeHtml, CSS };
