import { useEffect, useMemo, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";
import CountrySelect from "../components/CountrySelect";
import PageHeader from "../components/PageHeader";
import { IconFlame } from "../components/icons";
import ShareButtons from "../components/ShareButtons";
import { useSobriety } from "../lib/SobrietyContext";
import { useT } from "../lib/useT";
import { localeTag } from "../lib/dateLocale";
import ScrollableTable from "../components/ScrollableTable";
import { useApiFetch } from "../lib/useApiFetch";

export default function IncendiesPage() {
  const { t, locale } = useT();
  const { sobriety } = useSobriety();
  const lastUpdated = useLastUpdated();
  const [country, setCountry] = useState("FRA");
  const [view, setView] = useState("map");

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);

  useEffect(() => {
    if (sobriety) setView("table");
  }, [sobriety]);

  useEffect(() => {
    setCountry(detectDefaultCountry());
  }, []);

  const { data: countryRows } = useApiFetch("/api/co2/countries", {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const countries = countryRows ?? [];

  const { data: fireRows, loading, error } = useApiFetch(`/api/fires?country=${country}`, {
    errorMessage: t("incendies.error_no_data"),
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const fires = useMemo(() => fireRows ?? [], [fireRows]);

  useEffect(() => {
    if (view !== "map" || sobriety || !mapContainerRef.current) return;
    let cancelled = false;

    // Le CSS de Leaflet n'est plus chargé globalement pour toutes les pages
    // du site — seules celles qui affichent effectivement une carte en ont
    // besoin. Injecté ici, une seule fois, uniquement quand la carte est
    // effectivement affichée.
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "/vendor/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
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
            `Détecté le ${new Date(f.detected_at).toLocaleString(localeTag(locale))}<br/>Puissance radiative : ${f.frp ?? "?"} MW<br/>Confiance : ${f.confidence ?? "?"}%`
          )
          .addTo(markersLayerRef.current);
      });

      // Sans ça, Leaflet peut garder en mémoire de mauvaises dimensions
      // calculées au moment précis de la création (ex: juste après un
      // changement d'onglet, ou sur mobile où la mise en page peut prendre
      // un cycle de rendu de plus à se stabiliser) — la carte apparaît
      // alors grisée/mal cadrée. setTimeout(0) laisse le DOM se stabiliser
      // avant de forcer le recalcul.
      setTimeout(() => {
        if (!cancelled && mapRef.current) mapRef.current.invalidateSize();
      }, 0);

      if (fires.length > 0) {
        const bounds = L.latLngBounds(fires.map((f) => [f.latitude, f.longitude]));
        mapRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 8 });
      }
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersLayerRef.current = null;
    };
  }, [view, sobriety, fires]);

  const selectedCountryName = localizedCountryName(country, locale);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconFlame} tint="red" title={`${t("incendies.title")} — ${selectedCountryName}`} />
      <ShareButtons title={`${t("incendies.title")} — ${selectedCountryName}`} />

      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>{t("incendies.intro_p1")}</p>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>
        {t("incendies.intro_p2_prefix")}{" "}
        <span style={{ color: "#f4b400", fontWeight: 600 }}>{t("incendies.color_yellow")}</span> {t("incendies.color_yellow_desc")}{" "}
        <span style={{ color: "#e67e22", fontWeight: 600 }}>{t("incendies.color_orange")}</span> {t("incendies.color_orange_desc")}{" "}
        <span style={{ color: "#d63e2a", fontWeight: 600 }}>{t("incendies.color_red")}</span> {t("incendies.color_red_desc")}
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={country}
          onChange={setCountry}
          locale={locale}
        />
        <button onClick={() => setView(view === "map" ? "table" : "map")} disabled={sobriety}>
          {view === "map" ? t("common.view_as_table") : t("common.view_as_chart")}
        </button>
        {sobriety && (
          <span style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>{t("incendies.map_sobriety_disabled")}</span>
        )}
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && fires.length === 0 && <p>{t("incendies.no_recent_detections")}</p>}

      <div style={{ display: view === "map" ? "block" : "none" }}>
        <div ref={mapContainerRef} style={{ height: 480, borderRadius: 8 }} />
      </div>

      {!loading && !error && view === "table" && fires.length > 0 && (
        <ScrollableTable>
<table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 8 }}>
            {t("incendies.table_caption", { country: selectedCountryName })}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("incendies.table_detected_at")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("incendies.table_frp")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("incendies.table_confidence")}</th>
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
</ScrollableTable>
      )}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
        {t("incendies.source")}
        {lastUpdated?.fires?.latestDetection && (
          <> {t("incendies.source_latest", { date: formatDate(lastUpdated.fires.latestDetection) })}</>
        )}
        {" "}{t("incendies.source_refresh")}
      </p>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
