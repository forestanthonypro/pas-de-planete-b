// Conteneur de défilement horizontal pour les tableaux larges — évite que
// le tableau ne fasse déborder toute la page sur petit écran (mobile,
// app Capacitor). Seul le contenu du tableau glisse sur le côté, le reste
// de la mise en page reste dans son cadre.
//
// width: "100%" explicite (pas juste implicite via le comportement bloc
// par défaut) + -webkit-overflow-scrolling: touch : sans ça, sur certains
// navigateurs mobiles le geste de balayage peut "fuir" vers la page
// entière au lieu de rester contenu dans le tableau lui-même (repéré le
// 9 août 2026 — le tableau débordait visuellement au balayage plutôt que
// de défiler proprement dans sa propre boîte).
export default function ScrollableTable({ children }) {
  return (
    <div
      style={{
        overflowX: "auto",
        width: "100%",
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-x pan-y",
        overscrollBehaviorX: "contain",
        marginBottom: "0.5rem",
      }}
    >
      {children}
    </div>
  );
}
