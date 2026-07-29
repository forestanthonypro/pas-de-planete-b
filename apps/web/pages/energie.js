import { useEffect, useMemo, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { FUEL_COLORS, DEFAULT_FUEL_COLOR, translateFuel } from "../lib/fuelTypes";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";
import CountrySelect from "../components/CountrySelect";
import ShareButtons from "../components/ShareButtons";
import { useSobriety } from "../lib/SobrietyContext";
import { barEndLabelsPlugin } from "../lib/barEndLabelsPlugin";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function EnergiePage() {
  const lastUpdated = useLastUpdated();
  const [preferredLang, setPreferredLang] = useState(null);
  const [countries, setCountries] = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [country, setCountry] = useState("FRA");
  const [fuelType, setFuelType] = useState("");
  const [plants, setPlants] = useState([]);
  const [generation, setGeneration] = useState([]);
  const [view, setView] = useState("map"); // "map" ou "table"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { sobriety } = useSobriety();

  useEffect(() => {
    if (sobriety) setView("table");
  }, [sobriety]);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const mixCanvasRef = useRef(null);
  const mixChartRef = useRef(null);
  const generationCanvasRef = useRef(null);
  const generationChartRef = useRef(null);

  // Agrégation par filière (capacité totale + nombre de centrales) à partir
  // des centrales individuelles déjà chargées pour la carte/le tableau — pas
  // besoin d'un appel réseau supplémentaire, on recalcule juste côté client.
  const energyMix = useMemo(() => {
    const byFuel = {};
    for (const p of plants) {
      const key = p.fuel_type || "Autre";
      if (!byFuel[key]) byFuel[key] = { fuel_type: key, total_capacity_mw: 0, plant_count: 0 };
      byFuel[key].total_capacity_mw += p.capacity_mw || 0;
      byFuel[key].plant_count += 1;
    }
    return Object.values(byFuel).sort((a, b) => b.total_capacity_mw - a.total_capacity_mw);
  }, [plants]);

  // Devine le pays par défaut une fois côté client (évite un décalage serveur/client).
  useEffect(() => {
    setCountry(detectDefaultCountry());
    setPreferredLang(detectPreferredLanguage());
  }, []);

  // Charge les listes pour peupler les filtres, une seule fois.
  useEffect(() => {
    fetch(`${API_URL}/api/power-plants/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows.map((r) => r.country_code) : []))
      .catch(() => setCountries([]));

    fetch(`${API_URL}/api/power-plants/fuel-types`)
      .then((res) => res.json())
      .then((rows) => setFuelTypes(Array.isArray(rows) ? rows : []))
      .catch(() => setFuelTypes([]));
  }, []);

  // Recharge les centrales à chaque changement de filtre.
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ country });
    if (fuelType) params.set("fuel_type", fuelType);

    fetch(`${API_URL}/api/power-plants?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles pour ce filtre");
        return res.json();
      })
      .then((rows) => {
        setPlants(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [country, fuelType]);

  // Dessine le graphique de mix énergétique (capacité + nombre de centrales
  // par filière) — même graphique que sur le dashboard pays, pour rester
  // cohérent partout où cette information est présentée.
  useEffect(() => {
    if (energyMix.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !mixCanvasRef.current) return;
      if (mixChartRef.current) mixChartRef.current.destroy();

      mixChartRef.current = new Chart(mixCanvasRef.current, {
        type: "bar",
        data: {
          labels: energyMix.map((r) => translateFuel(r.fuel_type)),
          datasets: [
            {
              label: "Capacité (MW)",
              data: energyMix.map((r) => r.total_capacity_mw),
              backgroundColor: energyMix.map((r) => FUEL_COLORS[r.fuel_type] || DEFAULT_FUEL_COLOR),
              plantCounts: energyMix.map((r) => r.plant_count),
            },
          ],
        },
        plugins: [barEndLabelsPlugin],
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 90 } },
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: "Capacité (MW)" } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [energyMix]);

  // Génération électrique réelle par filière et par an — comparaison à la
  // capacité installée statique de la carte ci-dessus.
  useEffect(() => {
    fetch(`${API_URL}/api/electricity/${country}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setGeneration(Array.isArray(rows) ? rows : []))
      .catch(() => setGeneration([]));
  }, [country]);

  // Dessine le graphique de génération électrique réelle (empilé par filière).
  useEffect(() => {
    if (generation.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !generationCanvasRef.current) return;
      if (generationChartRef.current) generationChartRef.current.destroy();

      const sources = [
        { key: "coal_twh", label: translateFuel("Coal"), color: FUEL_COLORS.Coal },
        { key: "gas_twh", label: translateFuel("Gas"), color: FUEL_COLORS.Gas },
        { key: "oil_twh", label: translateFuel("Oil"), color: FUEL_COLORS.Oil },
        { key: "nuclear_twh", label: translateFuel("Nuclear"), color: FUEL_COLORS.Nuclear },
        { key: "hydro_twh", label: translateFuel("Hydro"), color: FUEL_COLORS.Hydro },
        { key: "wind_twh", label: translateFuel("Wind"), color: FUEL_COLORS.Wind },
        { key: "solar_twh", label: translateFuel("Solar"), color: FUEL_COLORS.Solar },
        { key: "biofuel_twh", label: translateFuel("Biomass"), color: FUEL_COLORS.Biomass },
        { key: "other_renewable_twh", label: "Autres renouvelables", color: DEFAULT_FUEL_COLOR },
      ];

      generationChartRef.current = new Chart(generationCanvasRef.current, {
        type: "bar",
        data: {
          labels: generation.map((d) => d.year),
          datasets: [
            ...sources.map((s) => ({
              label: s.label,
              data: generation.map((d) => d[s.key] || 0),
              backgroundColor: s.color || DEFAULT_FUEL_COLOR,
              stack: "generation",
            })),
            {
              type: "line",
              label: "Consommation réelle (demande)",
              data: generation.map((d) => d.demand_twh),
              borderColor: "#000000",
              borderWidth: 2,
              borderDash: [4, 3],
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, position: "bottom" } },
          scales: {
            x: { stacked: true },
            y: { stacked: true, title: { display: true, text: "TWh/an" } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [generation]);

  // Création de la carte (si besoin) PUIS dessin des marqueurs, toujours dans
  // le même appel — jamais dans deux effets séparés : l'import dynamique de
  // Leaflet est asynchrone, et rien ne garantissait que la carte soit créée
  // avant que le dessin des marqueurs ne s'exécute (course, carte vide
  // observée en pratique).
  useEffect(() => {
    if (view !== "map" || sobriety || !mapContainerRef.current) return;

    let cancelled = false;
    import("leaflet")
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; contributeurs OpenStreetMap",
            maxZoom: 18,
          }).addTo(mapRef.current);
          markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
        }

        markersLayerRef.current.clearLayers();
        plants.forEach((p) => {
          const color = FUEL_COLORS[p.fuel_type] || DEFAULT_FUEL_COLOR;
          const radius = p.capacity_mw ? Math.max(4, Math.min(20, Math.sqrt(p.capacity_mw))) : 5;

          L.circleMarker([p.latitude, p.longitude], {
            radius,
            color,
            fillColor: color,
            fillOpacity: 0.7,
            weight: 1,
          })
            .bindPopup(
              `<strong>${p.name}</strong><br/>${translateFuel(p.fuel_type)} — ${p.capacity_mw ?? "?"} MW`
            )
            .addTo(markersLayerRef.current);
        });

        if (plants.length > 0) {
          const bounds = L.latLngBounds(plants.map((p) => [p.latitude, p.longitude]));
          mapRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 8 });
        }
      })
      .catch((err) => {
        console.error("Échec de l'initialisation de la carte Leaflet :", err);
        setError("La carte n'a pas pu s'initialiser : " + err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [view, sobriety, plants]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Centrales électriques</h1>
      <ShareButtons title="Centrales électriques" />


      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={country}
          onChange={setCountry}
          preferredLang={preferredLang}
        />

        <label>
          Type de combustible{" "}
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
            <option value="">Tous</option>
            {fuelTypes.map((f) => (
              <option key={f} value={f}>{translateFuel(f)}</option>
            ))}
          </select>
        </label>

        <button onClick={() => setView(view === "map" ? "table" : "map")} disabled={sobriety}>
          Voir en {view === "map" ? "tableau" : "carte"}
        </button>
        {sobriety && (
          <span style={{ fontSize: 12, color: "#666" }}>
            Carte désactivée en mode sobriété (économise le téléchargement des tuiles)
          </span>
        )}
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}
      {!loading && !error && plants.length === 0 && <p>Aucune centrale trouvée pour ce filtre.</p>}

      <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
        Cette carte montre les centrales électriques existantes et leur <strong>capacité
        installée</strong> — la puissance maximale qu&apos;elles pourraient produire si elles
        tournaient à plein régime en permanence. Ce n&apos;est pas ce qu&apos;elles produisent
        réellement : un panneau solaire de 100 MW ne produit rien la nuit, une centrale nucléaire
        de 100 MW tourne presque tout le temps. Pour voir la production réelle, regarde le
        graphique plus bas.
      </p>

      <div style={{ display: view === "map" ? "block" : "none" }}>
        <div ref={mapContainerRef} style={{ height: 480, borderRadius: 8 }} />
      </div>

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Centrales électriques — {localizedCountryName(country, preferredLang)} {fuelType ? `(${fuelType})` : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Nom</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Type</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Capacité (MW)</th>
            </tr>
          </thead>
          <tbody>
            {plants.map((p, i) => (
              <tr key={i}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{p.name}</th>
                <td style={{ textAlign: "left", padding: 8 }}>{translateFuel(p.fuel_type)}</td>
                <td style={{ textAlign: "right", padding: 8 }}>{p.capacity_mw ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {energyMix.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Mix énergétique</h2>
          <p>
            <strong>{energyMix.length}</strong> types de production,{" "}
            <strong>{Math.round(energyMix.reduce((sum, r) => sum + r.total_capacity_mw, 0)).toLocaleString("fr-FR")} MW</strong>{" "}
            de capacité totale connue.
          </p>
          <p style={{ fontSize: 13, color: "#666" }}>
            Capacité installée par filière, avec le nombre de centrales — le même graphique que
            sur la fiche pays, pour retrouver la même information ici.
          </p>
          <div style={{ position: "relative", height: Math.max(200, energyMix.length * 34) }}>
            <canvas ref={mixCanvasRef} role="img" aria-label={`Mix énergétique de ${localizedCountryName(country, preferredLang)}, capacité et nombre de centrales par type`} />
          </div>
        </section>
      )}

      {generation.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Génération électrique réelle</h2>
          <p style={{ fontSize: 13, color: "#666" }}>
            À la différence de la carte ci-dessus (capacité installée, figée depuis 2021), voici
            ce qui est réellement produit chaque année, par filière — les barres empilées montrent
            le mix réel de production. La ligne noire en pointillés, c&apos;est la consommation
            réelle (la demande). Exemple : si la ligne noire est au-dessus des barres empilées,
            le pays importe de l&apos;électricité de ses voisins pour combler le manque ; si elle
            est en dessous, il en exporte.
          </p>
          <div style={{ position: "relative", height: 320 }}>
            <canvas ref={generationCanvasRef} role="img" aria-label={`Génération électrique réelle par filière pour ${localizedCountryName(country, preferredLang)}`} />
          </div>
          <p style={{ fontSize: 12, color: "#666", marginTop: "0.5rem" }}>
            Source : Ember / Energy Institute, via Our World in Data (CC-BY)
            {lastUpdated?.electricity?.latestYear && (
              <> — dernière année couverte : {lastUpdated.electricity.latestYear}</>
            )}
            . Rafraîchissement automatique mensuel.
          </p>
        </section>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : Global Power Plant Database, World Resources Institute (CC-BY 4.0) — dernière
        version publiée (v1.3.0) ; ce projet n&apos;est plus activement maintenu par WRI depuis
        2021-2022, les données ne reflètent donc pas nécessairement les toutes dernières centrales
        construites.
        {lastUpdated?.powerPlants?.lastIngested && (
          <> Dernière mise à jour de notre base : {formatDate(lastUpdated.powerPlants.lastIngested)}.</>
        )}
        {" "}Rafraîchissement automatique mensuel (sans effet tant que la source elle-même n&apos;évolue pas).
      </p>
    </div>
  );
}
