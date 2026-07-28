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

export { Chart };
export default Chart;
