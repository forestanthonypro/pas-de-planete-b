import { useEffect, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { localizedCountryName } from "../lib/countryNames";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import CountrySelect from "../components/CountrySelect";
import ShareButtons from "../components/ShareButtons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Co2Page() {
  const lastUpdated = useLastUpdated();
  const [preferredLang, setPreferredLang] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countryCode, setCountryCode] = useState("FRA");
  const [metric, setMetric] = useState("emissions_mt"); // ou "emissions_per_capita"
  const [data, setData] = useState([]);
  const [view, setView] = useState("chart"); // "chart" ou "table"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // Devine le pays par défaut une fois côté client (évite un décalage serveur/client).
  useEffect(() => {
    setCountryCode(detectDefaultCountry());
    setPreferredLang(detectPreferredLanguage());
  }, []);

  // Charge la liste des pays une seule fois, pour peupler le filtre.
  useEffect(() => {
    fetch(`${API_URL}/api/co2/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows : []))
      .catch(() => setCountries([]));
  }, []);

  // Recharge la série à chaque changement de pays.
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/co2/${countryCode}`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles pour ce pays");
        return res.json();
      })
      .then((rows) => {
        setData(rows);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [countryCode]);

  // Dessine/redessine le graphique quand les données, le métrique ou la vue changent.
  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;

    const consumptionField = metric === "emissions_mt" ? "consumption_co2" : "consumption_co2_per_capita";
    const hasConsumptionData = data.some((d) => d[consumptionField] !== null && d[consumptionField] !== undefined);

    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const datasets = [
        {
          label: metric === "emissions_mt" ? "Émis dans le pays (Mt CO2)" : "Émis dans le pays, par habitant (t)",
          data: data.map((d) => d[metric]),
          borderColor: "#2a78d6",
          backgroundColor: "rgba(42,120,214,0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ];

      if (hasConsumptionData) {
        datasets.push({
          label: metric === "emissions_mt" ? "Lié à ce qu'on achète, importé compris (Mt CO2)" : "Lié à ce qu'on achète, par habitant (t)",
          data: data.map((d) => d[consumptionField]),
          borderColor: "#e67e22",
          backgroundColor: "rgba(230,126,34,0.1)",
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [5, 4],
        });
      }

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: data.map((d) => d.year),
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: hasConsumptionData } },
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [data, metric, view, loading, error]);

  const selectedCountryName = localizedCountryName(countryCode, preferredLang);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Émissions de CO2 — {selectedCountryName}</h1>
      <ShareButtons title={`Émissions de CO2 — ${selectedCountryName}`} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={countryCode}
          onChange={setCountryCode}
          preferredLang={preferredLang}
        />

        <label>
          Unité{" "}
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="emissions_mt">Total (Mt)</option>
            <option value="emissions_per_capita">Par habitant (t)</option>
          </select>
        </label>

        <button onClick={() => setView(view === "chart" ? "table" : "chart")}>
          Voir en {view === "chart" ? "tableau" : "graphique"}
        </button>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      <h2 style={{ fontSize: 18, marginBottom: "0.25rem" }}>Que montre ce graphique ?</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
        La courbe bleue, c&apos;est ce qui est physiquement émis sur le sol du pays — usines,
        voitures, chauffage. La courbe orange en pointillés (quand elle existe), c&apos;est ce qui
        est lié à tout ce que les gens du pays achètent et consomment, y compris les objets
        fabriqués ailleurs et importés ensuite.
      </p>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
        Exemple concret : un objet fabriqué dans une usine à l&apos;étranger, puis acheté et
        utilisé ici. Sa fabrication a émis du CO2 là où l&apos;usine se trouve — ce CO2 compte
        dans la courbe bleue de ce pays-là, pas dans celle d&apos;ici, puisqu&apos;il n&apos;a pas
        été émis sur notre sol. Mais comme c&apos;est nous qui utilisons l&apos;objet, ce CO2
        &laquo; appartient &raquo; en réalité à notre consommation — c&apos;est ce que la courbe
        orange essaie de capter. Si l&apos;orange est au-dessus du bleu pour un pays, ça veut dire
        que ce pays achète (et fait donc émettre ailleurs) plus de CO2 qu&apos;il n&apos;en émet
        lui-même sur son propre sol.
      </p>
      <p style={{ fontSize: 13, color: "#666", fontWeight: 600, marginBottom: "0.75rem" }}>
        Important : ni la bleue ni l&apos;orange n&apos;est &laquo; la vraie &raquo; — les deux
        comptent de vraies émissions de CO2, juste avec deux règles différentes pour savoir à qui
        les attribuer (là où c&apos;est produit, ou par qui c&apos;est consommé). Et surtout : on
        ne les additionne jamais. Ce ne sont pas deux morceaux d&apos;un total — ce sont deux
        façons de découper le même total mondial d&apos;émissions.
      </p>

      {!loading && !error && view === "chart" && (
        <div style={{ position: "relative", height: 320 }}>
          <canvas ref={canvasRef} role="img" aria-label={`Émissions de CO2 pour ${selectedCountryName}`} />
        </div>
      )}

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Émissions de CO2 pour {selectedCountryName}, par année
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Année</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Émis dans le pays (Mt)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Émis dans le pays, par habitant (t)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Lié à ce qu&apos;on achète (Mt)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{d.year}</th>
                <td style={{ textAlign: "right", padding: 8 }}>{d.emissions_mt ?? "—"}</td>
                <td style={{ textAlign: "right", padding: 8 }}>{d.emissions_per_capita ?? "—"}</td>
                <td style={{ textAlign: "right", padding: 8 }}>{d.consumption_co2 ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details style={{ marginBottom: "1rem", fontSize: 13, color: "#555" }}>
        <summary style={{ cursor: "pointer" }}>Le détail méthodologique</summary>
        <p style={{ marginTop: 8 }}>
          La courbe pleine (bleue) montre les émissions <strong>territoriales</strong> (dites
          &laquo; de production &raquo;) : ce qui est physiquement émis sur le sol du pays (usines,
          transports, chauffage, agriculture...). Elle <strong>n&apos;inclut pas</strong> les
          émissions liées à la fabrication des produits importés — un objet fabriqué à
          l&apos;étranger et consommé ici compte dans les émissions du pays fabricant, pas dans
          celles d&apos;ici. C&apos;est la méthode utilisée par les États pour leurs engagements
          internationaux.
        </p>
        <p>
          La courbe en pointillés (orange), quand elle est disponible, montre les émissions
          &laquo; <strong>basées sur la consommation</strong> &raquo; : émissions territoriales,
          moins ce qui est exporté, plus ce qui est importé — elle reflète donc les importations.
          Elle n&apos;existe que pour certains pays (les plus
          grandes économies, avec des données commerciales suffisamment détaillées), et retarde
          toujours d&apos;un an sur les émissions territoriales.
        </p>
        <p>
          Dans les deux cas, les émissions de l&apos;aviation et du transport maritime
          internationaux ne sont comptées dans les chiffres d&apos;aucun pays.
        </p>
      </details>

      <p style={{ fontSize: 12, color: "#666" }}>
        Source : Global Carbon Project, via Our World in Data (CC-BY)
        {lastUpdated?.co2?.latestYear && (
          <> — dernière année couverte par la source : {lastUpdated.co2.latestYear}</>
        )}
        {lastUpdated?.co2?.lastIngested && (
          <> · dernière mise à jour de notre base : {formatDate(lastUpdated.co2.lastIngested)}</>
        )}
        . Rafraîchissement automatique mensuel.
      </p>
    </main>
  );
}
