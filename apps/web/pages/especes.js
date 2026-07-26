import { useEffect, useMemo, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { speciesGroupLabel } from "../lib/speciesGroups";
import { formatCommonNames } from "../lib/commonNames";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const CATEGORY_INFO = {
  EX: { label: "Éteinte", color: "#000000" },
  EW: { label: "Éteinte à l'état sauvage", color: "#3d3d3d" },
  CR: { label: "En danger critique", color: "#d63e2a" },
  EN: { label: "En danger", color: "#e67e22" },
  VU: { label: "Vulnérable", color: "#f4b400" },
  NT: { label: "Quasi menacée", color: "#cbd423" },
  LC: { label: "Préoccupation mineure", color: "#1baf7a" },
  DD: { label: "Données insuffisantes", color: "#95a5a6" },
};

export default function EspecesPage() {
  const lastUpdated = useLastUpdated();
  const [preferredLang, setPreferredLang] = useState(null);
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState("FRA");
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [group, setGroup] = useState("");
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [threatenedCounts, setThreatenedCounts] = useState([]);
  const [globalShare, setGlobalShare] = useState([]);
  const threatenedCanvasRef = useRef(null);
  const threatenedChartRef = useRef(null);

  useEffect(() => {
    setCountry(detectDefaultCountry());
    setPreferredLang(detectPreferredLanguage());
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/co2/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows : []))
      .catch(() => setCountries([]));

    fetch(`${API_URL}/api/species/categories`)
      .then((res) => res.json())
      .then((rows) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]));

    fetch(`${API_URL}/api/species-threatened/global/share`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setGlobalShare(Array.isArray(rows) ? rows : []))
      .catch(() => setGlobalShare([]));
  }, []);

  // Comptage officiel IUCN (mammifères/oiseaux/poissons), à distinguer de
  // l'échantillon GBIF affiché plus bas — voir la légende pour le détail.
  useEffect(() => {
    fetch(`${API_URL}/api/species-threatened/${country}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setThreatenedCounts(Array.isArray(rows) ? rows : []))
      .catch(() => setThreatenedCounts([]));
  }, [country]);

  useEffect(() => {
    if (threatenedCounts.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !threatenedCanvasRef.current) return;
      if (threatenedChartRef.current) threatenedChartRef.current.destroy();

      const latest = threatenedCounts[threatenedCounts.length - 1];
      threatenedChartRef.current = new Chart(threatenedCanvasRef.current, {
        type: "bar",
        data: {
          labels: ["Mammifères", "Oiseaux", "Poissons"],
          datasets: [
            {
              label: `Espèces menacées (${latest.year})`,
              data: [latest.mammals_threatened, latest.birds_threatened, latest.fish_threatened],
              backgroundColor: ["#8e44ad", "#4285f4", "#1baf7a"],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: "Nombre d'espèces menacées" } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [threatenedCounts]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (country) params.set("country", country);

    fetch(`${API_URL}/api/species?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      })
      .then((rows) => {
        setSpecies(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [category, country]);

  // Le groupe (Oiseau, Poisson, Escargot...) est calculé côté client à partir de la
  // classe/ordre taxonomique — pas une colonne filtrée côté API, donc le filtre
  // s'applique ici sur les résultats déjà récupérés.
  const availableGroups = useMemo(() => {
    const set = new Set(species.map((s) => speciesGroupLabel(s.kingdom, s.class, s.taxon_order)));
    return Array.from(set).sort();
  }, [species]);

  const filteredSpecies = useMemo(() => {
    if (!group) return species;
    return species.filter((s) => speciesGroupLabel(s.kingdom, s.class, s.taxon_order) === group);
  }, [species, group]);

  // Le pays/la catégorie changent la liste sous-jacente : le groupe sélectionné
  // peut ne plus exister dans les résultats, on le réinitialise proprement.
  useEffect(() => {
    if (group && !availableGroups.includes(group)) setGroup("");
  }, [availableGroups, group]);

  const selectedCountryName =
    localizedCountryName(country, preferredLang);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Espèces menacées — {selectedCountryName}</h1>

      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Échantillon d&apos;espèces observées dans ce pays, par catégorie d&apos;extinction UICN,
        à partir des occurrences republiées par GBIF. Ce n&apos;est pas la liste complète des
        espèces évaluées, mais un aperçu représentatif. Les noms communs sans traduction connue
        sont indiqués comme tels plutôt que devinés.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>
          Pays{" "}
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.length === 0 && <option value={country}>{country}</option>}
            {countries.map((c) => (
              <option key={c.country_code} value={c.country_code}>
                {localizedCountryName(c.country_code, preferredLang)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Groupe{" "}
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">Tous</option>
            {availableGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>

        <label>
          Catégorie{" "}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_INFO[c]?.label || c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}
      {!loading && !error && filteredSpecies.length === 0 && (
        <p>Aucune espèce trouvée pour ce filtre dans cet échantillon.</p>
      )}

      {!loading && !error && filteredSpecies.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Espèces — {selectedCountryName}
            {category ? ` (${CATEGORY_INFO[category]?.label || category})` : ""}
            {group ? ` — groupe : ${group}` : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Nom scientifique</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Noms communs</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Groupe</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Catégorie</th>
            </tr>
          </thead>
          <tbody>
            {filteredSpecies.map((s) => {
              const info = CATEGORY_INFO[s.category] || { label: s.category, color: "#999" };
              const names = formatCommonNames(s.common_names, preferredLang);
              return (
                <tr key={s.scientific_name}>
                  <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400, fontStyle: "italic" }}>
                    {s.scientific_name}
                  </th>
                  <td style={{ textAlign: "left", padding: 8, color: names ? "inherit" : "#999", fontSize: 13 }}>
                    {names || "non disponible"}
                  </td>
                  <td style={{ textAlign: "left", padding: 8 }}>
                    {speciesGroupLabel(s.kingdom, s.class, s.taxon_order)}
                  </td>
                  <td style={{ padding: 8 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "white",
                        backgroundColor: info.color,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {info.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : GBIF, occurrences classées par catégorie UICN via la collaboration GBIF-IUCN (CC-BY)
        {lastUpdated?.species?.lastIngested && (
          <> · dernière mise à jour de notre base : {formatDate(lastUpdated.species.lastIngested)}</>
        )}
        . Rafraîchissement automatique mensuel.
      </p>

      <section style={{ marginTop: "2.5rem", borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
        <h2>Comptage officiel d&apos;espèces menacées</h2>
        <p style={{ fontSize: 13, color: "#666" }}>
          À la différence de l&apos;échantillon GBIF ci-dessus, voici un comptage officiel issu
          des évaluations IUCN — mais limité à trois groupes seulement (mammifères, oiseaux,
          poissons), et en <strong>nombre absolu</strong>, pas en pourcentage : aucune source ne
          publie un total fiable d&apos;espèces présentes par pays pour calculer un vrai %.
        </p>
        {threatenedCounts.length > 0 ? (
          <div style={{ position: "relative", height: 180 }}>
            <canvas ref={threatenedCanvasRef} role="img" aria-label={`Nombre d'espèces menacées par groupe pour ${selectedCountryName}`} />
          </div>
        ) : (
          <p>Aucune donnée officielle pour ce pays.</p>
        )}

        {globalShare.length > 0 && (
          <>
            <h3 style={{ fontSize: 15, marginTop: "1.5rem" }}>Repère mondial (pas par pays)</h3>
            <p style={{ fontSize: 13, color: "#666" }}>
              Pour donner un ordre de grandeur : voici le % d&apos;espèces menacées{" "}
              <strong>dans le monde entier</strong>, par grand groupe (IUCN) — ce n&apos;est pas
              spécifique à {selectedCountryName}.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 6 }}>Groupe</th>
                  <th scope="col" style={{ textAlign: "right", padding: 6 }}>% menacé dans le monde</th>
                </tr>
              </thead>
              <tbody>
                {globalShare.map((g) => (
                  <tr key={g.taxon_group}>
                    <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>{g.taxon_group}</th>
                    <td style={{ textAlign: "right", padding: 6 }}>{g.share_percent} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
          IUCN Red List / UNEP-WCMC via Banque mondiale, via Our World in Data (CC-BY)
          {lastUpdated?.speciesThreatened?.latestYear && (
            <> — dernière année couverte : {lastUpdated.speciesThreatened.latestYear}</>
          )}
          .
        </p>
      </section>
    </main>
  );
}
