import { useEffect, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";
import CountrySelect from "../components/CountrySelect";
import ShareButtons from "../components/ShareButtons";
import { useSobriety } from "../lib/SobrietyContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function IncendiesPage() {
  const { sobriety } = useSobriety();
  const lastUpdated = useLastUpdated();
  const [preferredLang, setPreferredLang] = useState(null);
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState("FRA");
  const [fires, setFires] = useState([]);
  const [view, setView] = useState("map");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Mode sobriété : la carte (tuiles téléchargées à chaque affichage) est le
  // poste le plus lourd de cette page — on bascule automatiquement sur le
  // tableau et on n'initialise même pas la carte, plutôt que de la charger
  // puis la cacher visuellement (ce qui ne ferait rien économiser).
  useEffect(() => {
    if (sobriety) setView("table");
  }, [sobriety]);

  useEffect(() => {
    setCountry(detectDefaultCountry());
    setPreferredLang(detectPreferredLanguage());
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/co2/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows : []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/fires?country=${country}`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles pour ce pays");
        return res.json();
      })
      .then((rows) => {
        setFires(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [country]);

  useEffect(() => {
    if (view !== "map" || sobriety || !mapContainerRef.current || mapRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current) return;
      mapRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; contributeurs OpenStreetMap",
        maxZoom: 18,
      }).addTo(mapRef.current);
      markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [view, sobriety]);

  useEffect(() => {
    if (view !== "map" || !mapRef.current || !markersLayerRef.current) return;
    import("leaflet").then((L) => {
      markersLayerRef.current.clearLayers();

      fires.forEach((f) => {
        const frp = f.frp || 0;
        const color = frp > 50 ? "#d63e2a" : frp > 10 ? "#e67e22" : "#f4b400";
        L.circleMarker([f.latitude, f.longitude], {
          radius: 5,
          color,
          fillColor: color,
          fillOpacity: 0.7,
          weight: 1,
        })
          .bindPopup(
            `Détecté le ${new Date(f.detected_at).toLocaleString("fr-FR")}<br/>Puissance radiative : ${f.frp ?? "?"} MW<br/>Confiance : ${f.confidence ?? "?"}%`
          )
          .addTo(markersLayerRef.current);
      });

      if (fires.length > 0) {
        const bounds = L.latLngBounds(fires.map((f) => [f.latitude, f.longitude]));
        mapRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 8 });
      }
    });
  }, [fires, view]);

  const selectedCountryName =
    localizedCountryName(country, preferredLang);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Feux actifs — {selectedCountryName}</h1>
      <ShareButtons title={`Feux actifs — ${selectedCountryName}`} />


      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Détections satellite des 3 derniers jours (NASA FIRMS, capteur MODIS). Une détection
        n&apos;est pas nécessairement un feu de forêt incontrôlé — cela inclut aussi les brûlis
        agricoles et d&apos;autres sources de chaleur détectées par satellite.
      </p>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Les points sur la carte sont colorés selon l&apos;intensité de la chaleur détectée :{" "}
        <span style={{ color: "#f4b400", fontWeight: 600 }}>jaune</span> pour une détection
        modérée (souvent un brûlis agricole),{" "}
        <span style={{ color: "#e67e22", fontWeight: 600 }}>orange</span> pour intermédiaire, et{" "}
        <span style={{ color: "#d63e2a", fontWeight: 600 }}>rouge</span> pour les foyers les plus
        intenses, plus susceptibles d&apos;être de vrais feux de forêt.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={country}
          onChange={setCountry}
          preferredLang={preferredLang}
        />
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
      {!loading && !error && fires.length === 0 && <p>Aucune détection récente pour ce pays.</p>}

      <div style={{ display: view === "map" ? "block" : "none" }}>
        <div ref={mapContainerRef} style={{ height: 480, borderRadius: 8 }} />
      </div>

      {!loading && !error && view === "table" && fires.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Détections — {selectedCountryName}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Détecté le</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Puissance radiative (MW)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Confiance (%)</th>
            </tr>
          </thead>
          <tbody>
            {fires.slice(0, 200).map((f, i) => (
              <tr key={i}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                  {new Date(f.detected_at).toLocaleString("fr-FR")}
                </th>
                <td style={{ textAlign: "right", padding: 8 }}>{f.frp ?? "—"}</td>
                <td style={{ textAlign: "right", padding: 8 }}>{f.confidence ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : NASA FIRMS (MODIS_NRT) — données publiques.
        {lastUpdated?.fires?.latestDetection && (
          <> Détection la plus récente : {formatDate(lastUpdated.fires.latestDetection)}.</>
        )}
        {" "}Rafraîchissement automatique toutes les 6 heures.
      </p>
    </div>
  );
}
