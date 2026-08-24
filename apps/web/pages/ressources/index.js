import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import ScopeMultiSelect from "../../components/ScopeMultiSelect";
import ScopeBadges from "../../components/ScopeBadges";
import { scopeFlag } from "../../lib/scopes";
import { IconLandmark } from "../../components/icons";
import { useSobriety } from "../../lib/SobrietyContext";
import { useT } from "../../lib/useT";
import ScrollableTable from "../../components/ScrollableTable";
import Pagination from "../../components/Pagination";

const ONLINE_PAGE_SIZE = 20;


export default function RessourcesPage() {
  const { t, locale } = useT();
  const { sobriety } = useSobriety();
  const [tab, setTab] = useState("map");
  const [locations, setLocations] = useState([]);
  const [locationsTruncated, setLocationsTruncated] = useState(false);
  const [online, setOnline] = useState([]);
  const [onlinePage, setOnlinePage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Catégories toujours chargées (petite liste, nécessaire pour le
  // sélecteur de filtre lui-même, indépendamment de tout filtre choisi).
  useEffect(() => {
    fetch(`/api/resource-categories?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]));
  }, [locale]);

  // Lieux (carte) : volontairement PAS chargés tant qu'aucun filtre n'est
  // choisi. Sans ça, la page charge par défaut les ~66 000 lieux du monde
  // entier d'un coup (import en masse OSM/DATAtourisme, 24/08/2026) —
  // aucune optimisation côté navigateur ne rend ça instantané, il faut
  // réduire ce qui est demandé, pas seulement comment c'est affiché.
  // Même principe que /energie.js, qui ne charge jamais les ~35 000
  // centrales du monde entier d'un coup non plus.
  const hasLocationFilter = scopeFilter.length > 0 || categoryFilter !== "";

  useEffect(() => {
    if (!hasLocationFilter) {
      setLocations([]);
      setLocationsTruncated(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const scopesParam = scopeFilter.length > 0 ? `&scopes=${scopeFilter.join(",")}` : "";
    const categoryParam = categoryFilter ? `&category=${categoryFilter}` : "";
    fetch(`/api/resource-locations?locale=${locale}${scopesParam}${categoryParam}`)
      .then((res) => (res.ok ? res.json() : { results: [], truncated: false }))
      .then((locationData) => {
        setLocations(Array.isArray(locationData?.results) ? locationData.results : []);
        setLocationsTruncated(Boolean(locationData?.truncated));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [locale, scopeFilter, categoryFilter, hasLocationFilter]);

  // Les ressources en ligne (plateformes, sites...) sont un jeu de données
  // restreint — contrairement aux lieux (~66 000 avec l'import OSM/
  // DATAtourisme du 24/08/2026), rien ne justifie d'exiger un filtre avant
  // affichage ici. Elles restent filtrables par pays/zone (le filtre
  // scope reste pertinent), juste pas obligatoires pour un premier
  // affichage.
  useEffect(() => {
    const scopesParam = scopeFilter.length > 0 ? `&scopes=${scopeFilter.join(",")}` : "";
    fetch(`/api/resource-online?locale=${locale}${scopesParam}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((onlineRows) => setOnline(Array.isArray(onlineRows) ? onlineRows : []))
      .catch(() => setOnline([]));
  }, [locale, scopeFilter]);

  // Le filtre catégorie est maintenant appliqué côté serveur (voir
  // categoryParam ci-dessus) — filteredLocations ne fait donc plus que
  // repasser les données telles quelles, gardé pour ne pas devoir
  // renommer partout ailleurs dans le fichier.
  const filteredLocations = locations;

  const filteredOnline = useMemo(() => {
    if (!categoryFilter) return online;
    return online.filter((o) => o.category_slug === categoryFilter);
  }, [online, categoryFilter]);

  useEffect(() => {
    setOnlinePage(1);
  }, [categoryFilter, scopeFilter]);

  useEffect(() => {
    if (tab !== "map" || sobriety || !hasLocationFilter || !mapContainerRef.current) return;
    let cancelled = false;

    // Le CSS de Leaflet n'est plus chargé globalement pour toutes les pages
    // du site (import "leaflet/dist/leaflet.css" dans _app.js retiré) —
    // seule cette page en a besoin. Injecté ici, une seule fois, uniquement
    // quand la carte est effectivement affichée.
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "/vendor/leaflet.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById("leaflet-markercluster-css")) {
      const link1 = document.createElement("link");
      link1.id = "leaflet-markercluster-css";
      link1.rel = "stylesheet";
      link1.href = "/vendor/MarkerCluster.css";
      document.head.appendChild(link1);
      const link2 = document.createElement("link");
      link2.id = "leaflet-markercluster-default-css";
      link2.rel = "stylesheet";
      link2.href = "/vendor/MarkerCluster.Default.css";
      document.head.appendChild(link2);
    }

    import("leaflet")
      .then((leafletModule) => {
        const L = leafletModule.default || leafletModule;
        // leaflet.markercluster est un plugin à l'ancienne qui s'attache à
        // une variable globale `L` plutôt que d'exporter proprement son
        // propre module — on doit donc la poser explicitement avant de
        // l'importer, plutôt que de compter sur un comportement implicite
        // qui varie selon la façon dont le bundler résout les imports.
        if (typeof window !== "undefined") window.L = L;
        return import("leaflet.markercluster").then(() => L);
      })
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = L.map(mapContainerRef.current).setView([46.6, 2.2], 5);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; contributeurs OpenStreetMap",
            maxZoom: 18,
          }).addTo(mapRef.current);
          // Regroupe les marqueurs proches en bulles à faible zoom plutôt
          // que de dessiner individuellement les ~66 000 lieux d'un coup
          // (import en masse OSM/DATAtourisme, 24/08/2026) — même besoin et
          // même solution que pour les ~35 000 centrales sur /energie.
          // chunkedLoading : ajoute les marqueurs par lots (via
          // requestAnimationFrame en interne) plutôt que d'un bloc, pour ne
          // pas geler l'onglet le temps de traiter des dizaines de milliers
          // de lieux.
          markersLayerRef.current = L.markerClusterGroup({
            maxClusterRadius: 50,
            chunkedLoading: true,
            chunkInterval: 100,
            chunkDelay: 20,
          }).addTo(mapRef.current);
        }

        markersLayerRef.current.clearLayers();
        const markers = filteredLocations.map((loc) => {
          // Le HTML du popup n'est construit qu'à l'ouverture (bindPopup
          // accepte une fonction), pas pour chacun des ~66 000 lieux dès le
          // chargement — sinon on paie le coût de construction de 66 000
          // chaînes HTML même pour les lieux jamais cliqués.
          const marker = L.circleMarker([loc.latitude, loc.longitude], {
            radius: 8,
            color: "#1b5e20",
            fillColor: "#1baf7a",
            fillOpacity: 0.85,
            weight: 2,
          });
          marker.bindPopup(() => {
            const linksHtml = (loc.links || [])
              .map((link) => `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>`)
              .join(" · ");
            const flagsHtml = (loc.scope_codes || []).map((c) => scopeFlag(c)).join(" ");
            const attributionHtml = loc.license_attribution
              ? `<br/><span style="font-size:11px;color:#666">${loc.license_attribution}</span>`
              : "";
            return `<strong>${loc.name}</strong>${flagsHtml ? ` ${flagsHtml}` : ""}<br/>${loc.description}${loc.address ? `<br/><em>${loc.address}</em>` : ""}${linksHtml ? `<br/>${linksHtml}` : ""}${attributionHtml}`;
          });
          return marker;
        });
        // addLayers (au pluriel) traite le tableau efficacement en un seul
        // passage interne à markercluster, plutôt que 66 000 appels
        // individuels à addTo() — gain notable sur un aussi gros volume.
        markersLayerRef.current.addLayers(markers);

        if (filteredLocations.length > 0) {
          const bounds = L.latLngBounds(filteredLocations.map((l) => [l.latitude, l.longitude]));
          mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
        }

        setTimeout(() => {
          if (!cancelled && mapRef.current) mapRef.current.invalidateSize();
        }, 50);
      })
      .catch((err) => {
        console.error("Échec de l'initialisation de la carte Leaflet :", err);
      });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersLayerRef.current = null;
    };
  }, [tab, sobriety, filteredLocations, hasLocationFilter]);

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

      <div style={{ maxWidth: 400, marginBottom: "1rem" }}>
        <ScopeMultiSelect
          value={scopeFilter}
          onChange={setScopeFilter}
          locale={locale}
          label={t("common.filter_by_scope")}
          placeholder={t("common.country_search_placeholder")}
        />
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
        {!hasLocationFilter ? (
          <p>{t("ressources.choose_filter_prompt")}</p>
        ) : sobriety ? (
          filteredLocations.length === 0 ? (
            <p>{t("ressources.no_locations")}</p>
          ) : (
            <>
              {locationsTruncated && (
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginBottom: "0.5rem" }}>
                  {t("ressources.truncated_note")}
                </p>
              )}
              <ScrollableTable>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("ressources.table_name")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("ressources.table_category")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("ressources.table_address")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("ressources.table_links")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("common.filter_by_scope")}</th>
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
                      <td style={{ padding: 8 }}>
                        {loc.scope_codes && loc.scope_codes.length > 0 && <ScopeBadges codes={loc.scope_codes} locale={locale} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
            </>
          )
        ) : (
          <>
            {locationsTruncated && (
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginBottom: "0.5rem" }}>
                {t("ressources.truncated_note")}
              </p>
            )}
            {filteredLocations.length === 0 && <p>{t("ressources.no_locations")}</p>}
            <div ref={mapContainerRef} style={{ height: 480, borderRadius: 8 }} />
          </>
        )}
      </div>

      {!loading && !error && tab === "online" && (
        filteredOnline.length === 0 ? (
          <p>{t("ressources.no_online")}</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {filteredOnline.slice((onlinePage - 1) * ONLINE_PAGE_SIZE, onlinePage * ONLINE_PAGE_SIZE).map((o) => (
                <div key={o.slug} className="pdpb-card">
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
                    {o.title} {o.scope_codes && o.scope_codes.length > 0 && <ScopeBadges codes={o.scope_codes} locale={locale} />}
                  </p>
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
            {filteredOnline.length > ONLINE_PAGE_SIZE && (
              <Pagination
                page={onlinePage}
                totalPages={Math.max(1, Math.ceil(filteredOnline.length / ONLINE_PAGE_SIZE))}
                onChange={setOnlinePage}
              />
            )}
          </>
        )
      )}
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
