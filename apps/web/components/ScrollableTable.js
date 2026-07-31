// Conteneur de défilement horizontal pour les tableaux larges — évite que
// le tableau ne fasse déborder toute la page sur petit écran (mobile,
// app Capacitor). Seul le contenu du tableau glisse sur le côté, le reste
// de la mise en page reste dans son cadre.
export default function ScrollableTable({ children }) {
  return <div style={{ overflowX: "auto", marginBottom: "0.5rem" }}>{children}</div>;
}
