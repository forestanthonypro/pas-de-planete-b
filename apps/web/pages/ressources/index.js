import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconLandmark } from "../../components/icons";
import { useSobriety } from "../../lib/SobrietyContext";
import { useT } from "../../lib/useT";
import ScrollableTable from "../../components/ScrollableTable";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function RessourcesPage() {
  const { t, locale } = useT();
  const { sobriety } = useSobriety();
  const [tab, setTab] = useState("map");
  const [locations, setLocations] = useState([]);
  const [online, setOnline] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/resource-locations?locale=${locale}`).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API_URL}/api/resource-online?locale=${locale}`).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API_URL}/api/resource-categories`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([locationRows, onlineRows, categoryRows]) => {
        setLocations(Array.isArray(locationRows) ? locationRows : []);
        setOnline(Array.isArray(onlineRows) ? onlineRows : []);
        setCategories(Array.isArray(categoryRows) ? categoryRows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [locale]);

  const filteredLocations = useMemo(() => {
    if (!categoryFilter) return locations;
    return locations.filter((l) => l.category_slug === categoryFilter);
  }, [locations, categoryFilter]);

  const filteredOnline = useMemo(() => {
    if (!categoryFilter) return online;
    return online.filter((o) => o.category_slug === categoryFilter);
  }, [online, categoryFilter]);

  useEffect(() => {
    if (tab !== "map" || sobriety || !mapContainerRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current).setView([46.6, 2.2], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; contributeurs OpenStreetMap",
          maxZoom: 18,
        }).addTo(mapRef.current);
        markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      markersLayerRef.current.clearLayers();
      filteredLocations.forEach((loc) => {
        const linksHtml = (loc.links || [])
          .map((link) => `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>`)
          .join(" · ");
        L.circleMarker([loc.latitude, loc.longitude], {
          radius: 8,
          color: "#1b5e20",
          fillColor: "#1baf7a",
          fillOpacity: 0.85,
          weight: 2,
        })
          .bindPopup(
            `<strong>${loc.name}</strong><br/>${loc.description}${loc.address ? `<br/><em>${loc.address}</em>` : ""}${linksHtml ? `<br/>${linksHtml}` : ""}`
          )
          .addTo(markersLayerRef.current);
      });

      if (filteredLocations.length > 0) {
        const bounds = L.latLngBounds(filteredLocations.map((l) => [l.latitude, l.longitude]));
        mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      }

      setTimeout(() => {
        if (!cancelled && mapRef.current) mapRef.current.invalidateSize();
      }, 50);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, sobriety, filteredLocations]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconLandmark} tint="green" title={t("ressources.title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", maxWidth: 600, margin: 0 }}>{t("ressources.intro")}</p>
      </PageHeader>

      <ShareButtons title={t("ressources.share_title")} />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={() => setTab("map")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: tab === "map" ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
            background: tab === "map" ? "var(--color-carte-verte)" : "var(--color-fond)",
            color: "var(--color-texte)",
            fontWeight: tab === "map" ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {t("ressources.tab_map")}
        </button>
        <button
          type="button"
          onClick={() => setTab("online")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: tab === "online" ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
            background: tab === "online" ? "var(--color-carte-verte)" : "var(--color-fond)",
            color: "var(--color-texte)",
            fontWeight: tab === "online" ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {t("ressources.tab_online")}
        </button>

        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ marginLeft: "auto", border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "var(--color-fond)", color: "var(--color-texte)" }}
          >
            <option value="">{t("ressources.category_all")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <p style={{ fontSize: 12, marginBottom: "1rem" }}>
        <Link
          href="/ressources/proposer"
          style={
            sobriety
              ? { color: "var(--color-forest)", textDecoration: "underline" }
              : {
                  display: "inline-block",
                  background: "var(--color-forest)",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: 20,
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 13,
                }
          }
        >
          {t("ressources.propose_link")}
        </Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      <div style={{ display: !loading && !error && tab === "map" ? "block" : "none" }}>
        {sobriety ? (
          filteredLocations.length === 0 ? (
            <p>{t("ressources.no_locations")}</p>
          ) : (
            <ScrollableTable>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("ressources.table_name")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("ressources.table_category")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("ressources.table_address")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("ressources.table_links")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocations.map((loc) => (
                    <tr key={loc.slug}>
                      <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>{loc.name}</th>
                      <td style={{ padding: 8 }}>{loc.category_name || "—"}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{loc.address || "—"}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>
                        {(loc.links || []).map((link, i) => (
                          <span key={link.url}>
                            {i > 0 && " · "}
                            <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          )
        ) : (
          <>
            {filteredLocations.length === 0 && <p>{t("ressources.no_locations")}</p>}
            <div ref={mapContainerRef} style={{ height: 480, borderRadius: 8 }} />
          </>
        )}
      </div>

      {!loading && !error && tab === "online" && (
        filteredOnline.length === 0 ? (
          <p>{t("ressources.no_online")}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {filteredOnline.map((o) => (
              <div key={o.slug} className="pdpb-card">
                <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{o.title}</p>
                {o.category_name && (
                  <p style={{ fontSize: 11, color: "var(--color-texte-clair)", textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 6px" }}>
                    {o.category_name}
                  </p>
                )}
                <p style={{ fontSize: 13, margin: "0 0 8px" }}>{o.description}</p>
                <a href={o.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>
                  {t("ressources.visit_link")}
                </a>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
