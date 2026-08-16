import { formatNumber } from "./kitTemplate.js";

// Image de prévisualisation Open Graph (og:image) — au format standard
// 1200×630, pensée pour rester lisible même affichée en petit (bulle de
// chat, fil d'actualité). Option A validée : bandeau + chiffre unique,
// volontairement sobre plutôt que chargée d'informations illisibles à
// cette taille.
export function buildOgImageHtml(countryName, tempDeviation, labels) {
  const hasTemp = tempDeviation !== null && tempDeviation !== undefined;
  const statValue = hasTemp ? `${tempDeviation > 0 ? "+" : ""}${formatNumber(tempDeviation, 1)} °C` : null;

  return `<!DOCTYPE html>
<html lang="${labels.lang || "fr"}">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px;
    background: #f4f1e8;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
  }
  .band {
    background: #1b5e20; height: 90px;
    display: flex; align-items: center; gap: 14px; padding: 0 60px;
  }
  .brand { color: #fff; font-size: 20px; font-weight: 700; letter-spacing: 0.03em; }
  .leaf { width: 34px; height: 34px; }
  .body-content { padding: 50px 60px; }
  .country { font-size: 30px; color: #5c5b52; font-weight: 600; margin-bottom: 6px; }
  .stat { font-size: 130px; font-weight: 800; color: #1b5e20; line-height: 1; }
  .stat-fallback { font-size: 56px; font-weight: 800; color: #1b5e20; line-height: 1.2; max-width: 900px; }
  .stat-label { font-size: 26px; color: #1c1c18; margin-top: 10px; max-width: 700px; }
  .tagline { position: absolute; bottom: 40px; left: 60px; font-size: 18px; color: #5c5b52; }
</style>
</head>
<body>
  <div class="band">
    <svg class="leaf" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75"><path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14Z"/><path d="M5 19c0-4 3-7 7-9"/></svg>
    <span class="brand">PAS DE PLANÈTE B</span>
  </div>
  <div class="body-content">
    <p class="country">${countryName}</p>
    ${
      hasTemp
        ? `<p class="stat">${statValue}</p>
           <p class="stat-label">${labels.referenceLabel}</p>`
        : `<p class="stat-fallback">${labels.ogFallbackTitle}</p>`
    }
  </div>
  <p class="tagline">${labels.ogTagline}</p>
</body>
</html>`;
}
