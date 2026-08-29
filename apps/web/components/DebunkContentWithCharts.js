import dynamic from "next/dynamic";

// Chart.js (~60-100 Ko) n'est chargé qu'à la demande, quand il y a
// vraiment un graphique à afficher — beaucoup de débunks du jour n'en ont
// aucun, et /decouverte (page mesurée par le pipeline EcoIndex/Lighthouse,
// voir ci.yml) importait Chart.js à chaque visite même dans ce cas.
// ssr:false : Chart.js dessine sur un <canvas>, entièrement côté client de
// toute façon (voir DebunkCharts.js) — le rendu serveur n'apporterait rien.
const DebunkCharts = dynamic(() => import("./DebunkCharts"), { ssr: false, loading: () => null });

// Découpe le texte "reality" autour de repères [[chart:0]], [[chart:1]]...
// pour permettre à un admin d'insérer un graphique n'importe où dans le
// texte, pas uniquement à la fin. Les graphiques du tableau "charts" non
// référencés par un repère s'affichent malgré tout à la fin (comportement
// historique conservé, entièrement rétrocompatible avec les entrées créées
// avant cette fonctionnalité).
//
// Exemple dans le texte : "...comme le montre ce graphique. [[chart:0]]
// On voit ensuite que..." insère le premier graphique du tableau "charts"
// exactement à cet endroit.
const MARKER_RE = /\[\[chart:(\d+)\]\]/g;

function splitContent(reality, charts) {
  const segments = [];
  const usedIndices = new Set();
  if (!reality) return { segments, usedIndices };

  let lastIndex = 0;
  let match;
  MARKER_RE.lastIndex = 0;
  while ((match = MARKER_RE.exec(reality)) !== null) {
    const textBefore = reality.slice(lastIndex, match.index);
    if (textBefore.trim()) segments.push({ type: "text", content: textBefore });

    const idx = parseInt(match[1], 10);
    if (Array.isArray(charts) && charts[idx]) {
      segments.push({ type: "chart", chart: charts[idx] });
      usedIndices.add(idx);
    }
    lastIndex = MARKER_RE.lastIndex;
  }
  const textAfter = reality.slice(lastIndex);
  if (textAfter.trim() || segments.length === 0) segments.push({ type: "text", content: textAfter });

  return { segments, usedIndices };
}

// reality : le texte brut (peut contenir des repères [[chart:N]] ou non).
// charts : le tableau déjà validé (voir chartValidation.js côté API).
// textStyle : style optionnel appliqué aux paragraphes de texte, pour
// s'adapter au contexte d'affichage (ex. aperçu compact sur /decouverte,
// avec une police plus petite que sur la page de détail complète).
export default function DebunkContentWithCharts({ reality, charts, textStyle }) {
  const { segments, usedIndices } = splitContent(reality, charts);
  const remainingCharts = Array.isArray(charts) ? charts.filter((_, i) => !usedIndices.has(i)) : [];

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <p key={i} style={{ whiteSpace: "pre-wrap", ...textStyle }}>
            {seg.content}
          </p>
        ) : (
          <DebunkCharts key={i} charts={[seg.chart]} />
        )
      )}
      {remainingCharts.length > 0 && <DebunkCharts charts={remainingCharts} />}
    </>
  );
}
