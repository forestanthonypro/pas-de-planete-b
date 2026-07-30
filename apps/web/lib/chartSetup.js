// Enregistrement ciblé de Chart.js — seuls les types de graphiques
// réellement utilisés dans l'app (barres, lignes, donuts) sont enregistrés,
// au lieu de "chart.js/auto" qui embarque tout (radar, polar, bulles,
// échelle temporelle...) et pèse nettement plus lourd.
//
// Import une seule fois ici, réutilisé partout : `import { Chart } from
// "../lib/chartSetup"` (ou "../../lib/chartSetup" selon la profondeur).
import {
  Chart,
  BarController,
  LineController,
  DoughnutController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler,
} from "chart.js";

Chart.register(
  BarController,
  LineController,
  DoughnutController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler
);

// Couleur de texte par défaut pour TOUS les graphiques du site (libellés
// d'axes, légendes) — un gris moyen qui reste lisible aussi bien sur fond
// clair que sur fond sombre. Sans ça, Chart.js retombe sur un gris foncé
// par défaut, invisible en mode sombre (graphiques qui semblent "vides").
// Un seul réglage ici plutôt que de le répéter dans chaque graphique.
Chart.defaults.color = "#9aa3a0";
Chart.defaults.scale.grid.color = "rgba(154, 163, 160, 0.2)";

export { Chart };
export default Chart;
