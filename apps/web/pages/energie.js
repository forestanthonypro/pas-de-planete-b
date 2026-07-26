import { useEffect, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { FUEL_COLORS, DEFAULT_FUEL_COLOR, translateFuel } from "../lib/fuelTypes";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function EnergiePage() {
  const lastUpdated = useLastUpdated();
  const [preferredLang, setPreferredLang] = useState(null);
  const [countries, setCountries] = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [country, setCountry] = useState("FRA");
  const [fuelType, setFuelType] = useState("");
  const [plants, setPlants] = useState([]);
  const [view, setView] = useState("map"); // "map" ou "table"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);

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

  // Initialise la carte une seule fois.
  useEffect(() => {
    if (view !== "map" || !mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    import("leaflet")
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return;
        mapRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; contributeurs OpenStreetMap",
          maxZoom: 18,
        }).addTo(mapRef.current);
        markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
      })
      .catch((err) => {
        console.error("Échec de l'initialisation de la carte Leaflet :", err);
        setError("La carte n'a pas pu s'initialiser : " + err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [view]);

  // Redessine les marqueurs à chaque changement de données.
  useEffect(() => {
    if (view !== "map" || !mapRef.current || !markersLayerRef.current) return;

    import("leaflet").then((L) => {
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
    });
  }, [plants, view]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Centrales électriques</h1>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>
          Pays{" "}
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.length === 0 && <option value={country}>{localizedCountryName(country, preferredLang)}</option>}
            {countries.map((c) => (
              <option key={c} value={c}>{localizedCountryName(c, preferredLang)}</option>
            ))}
          </select>
        </label>

        <label>
          Type de combustible{" "}
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
            <option value="">Tous</option>
            {fuelTypes.map((f) => (
              <option key={f} value={f}>{translateFuel(f)}</option>
            ))}
          </select>
        </label>

        <button onClick={() => setView(view === "map" ? "table" : "map")}>
          Voir en {view === "map" ? "tableau" : "carte"}
        </button>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}
      {!loading && !error && plants.length === 0 && <p>Aucune centrale trouvée pour ce filtre.</p>}

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
    </main>
  );
}
