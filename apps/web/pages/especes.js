import { useEffect, useMemo, useRef, useState } from "react";
import { useCountrySelector } from "../lib/useCountrySelector";
import { speciesGroupLabel } from "../lib/speciesGroups";
import { translateTaxonGroup } from "../lib/taxonGroupNames";
import { formatCommonNames } from "../lib/commonNames";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localeTag } from "../lib/dateLocale";
import CountrySelect from "../components/CountrySelect";
import PageHeader from "../components/PageHeader";
import { IconPaw } from "../components/icons";
import ShareButtons from "../components/ShareButtons";
import ScrollableTable from "../components/ScrollableTable";
import { useT } from "../lib/useT";
import { useApiFetch } from "../lib/useApiFetch";

function useCategoryInfo(t) {
  return {
    EX: { label: t("especes.cat_ex"), color: "#000000" },
    EW: { label: t("especes.cat_ew"), color: "#3d3d3d" },
    CR: { label: t("especes.cat_cr"), color: "#d63e2a" },
    EN: { label: t("especes.cat_en"), color: "#e67e22" },
    VU: { label: t("especes.cat_vu"), color: "#f4b400" },
    NT: { label: t("especes.cat_nt"), color: "#cbd423" },
    LC: { label: t("especes.cat_lc"), color: "#1baf7a" },
    DD: { label: t("especes.cat_dd"), color: "#95a5a6" },
  };
}

export default function EspecesPage() {
  const { t, locale } = useT();
  const CATEGORY_INFO = useCategoryInfo(t);
  const lastUpdated = useLastUpdated();
  const { countryCode: country, setCountryCode: setCountry, countries, selectedCountryName } = useCountrySelector("/api/co2/countries", { locale });
  const [category, setCategory] = useState("");
  const [group, setGroup] = useState("");
  const threatenedCanvasRef = useRef(null);
  const threatenedChartRef = useRef(null);

  const { data: categoryRows } = useApiFetch("/api/species/categories", {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const categories = categoryRows ?? [];

  const { data: globalShareRows } = useApiFetch("/api/species-threatened/global/share", {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const globalShare = globalShareRows ?? [];

  const { data: threatenedRows } = useApiFetch(`/api/species-threatened/${country}`, {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const threatenedCounts = threatenedRows ?? [];

  useEffect(() => {
    if (threatenedCounts.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !threatenedCanvasRef.current) return;
      if (threatenedChartRef.current) threatenedChartRef.current.destroy();
      const latest = threatenedCounts[threatenedCounts.length - 1];
      threatenedChartRef.current = new Chart(threatenedCanvasRef.current, {
        type: "bar",
        data: {
          labels: [t("especes.chart_mammals"), t("especes.chart_birds"), t("especes.chart_fish")],
          datasets: [
            {
              label: t("especes.chart_threatened_year", { year: latest.year }),
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
            x: { title: { display: true, text: t("especes.axis_threatened_count") } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threatenedCounts]);

  const speciesParams = new URLSearchParams();
  if (category) speciesParams.set("category", category);
  if (country) speciesParams.set("country", country);
  const { data: speciesRows, loading, error } = useApiFetch(`/api/species?${speciesParams}`, {
    errorMessage: t("especes.error_no_data"),
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const species = useMemo(() => speciesRows ?? [], [speciesRows]);

  const availableGroups = useMemo(() => {
    const set = new Set(species.map((s) => speciesGroupLabel(s.kingdom, s.class, s.taxon_order, locale)));
    return Array.from(set).sort();
  }, [species, locale]);

  const filteredSpecies = useMemo(() => {
    if (!group) return species;
    return species.filter((s) => speciesGroupLabel(s.kingdom, s.class, s.taxon_order, locale) === group);
  }, [species, group, locale]);

  useEffect(() => {
    if (group && !availableGroups.includes(group)) setGroup("");
  }, [availableGroups, group]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconPaw} tint="tan" title={`${t("especes.title")} — ${selectedCountryName}`} />
      <ShareButtons title={`${t("especes.title")} — ${selectedCountryName}`} />
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>{t("especes.intro_p1")}</p>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>{t("especes.intro_p2")}</p>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={country}
          onChange={setCountry}
          preferredLang={locale}
        />
        <label>
          {t("especes.group_label")}{" "}
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">{t("especes.all_groups")}</option>
            {availableGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label>
          {t("especes.category_label")}{" "}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t("especes.all_categories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_INFO[c]?.label || c}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && filteredSpecies.length === 0 && <p>{t("especes.no_species")}</p>}
      {!loading && !error && filteredSpecies.length > 0 && (
        <ScrollableTable>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
            <caption style={{ textAlign: "left", fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 8 }}>
              {t("especes.table_caption", {
                country: selectedCountryName,
                category: category ? ` (${CATEGORY_INFO[category]?.label || category})` : "",
                group: group ? t("especes.table_group_suffix", { group }) : "",
              })}
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("especes.table_scientific_name")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("especes.table_common_names")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("especes.table_group")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("especes.table_category")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSpecies.map((s) => {
                const info = CATEGORY_INFO[s.category] || { label: s.category, color: "var(--color-texte-clair)" };
                const names = formatCommonNames(s.common_names, locale);
                return (
                  <tr key={s.scientific_name}>
                    <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400, fontStyle: "italic" }}>
                      {s.scientific_name}
                    </th>
                    <td style={{ textAlign: "left", padding: 8, color: names ? "inherit" : "var(--color-texte-clair)", fontSize: 13 }}>
                      {names || t("especes.name_unavailable")}
                    </td>
                    <td style={{ textAlign: "left", padding: 8 }}>
                      {speciesGroupLabel(s.kingdom, s.class, s.taxon_order, locale)}
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
        </ScrollableTable>
      )}
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
        {t("especes.source")}
        {lastUpdated?.species?.lastIngested && (
          <> {t("especes.source_last_updated", { date: formatDate(lastUpdated.species.lastIngested, locale) })}</>
        )}
        {t("especes.source_refresh")}
      </p>
      <section style={{ marginTop: "2.5rem", borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
        <h2>{t("especes.official_count_title")}</h2>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("especes.official_count_explain")}</p>
        {threatenedCounts.length > 0 ? (
          <div style={{ position: "relative", height: 180 }}>
            <canvas ref={threatenedCanvasRef} role="img" aria-label={t("especes.official_count_title")} />
          </div>
        ) : (
          <p>{t("especes.no_official_data")}</p>
        )}
        {globalShare.length > 0 && (
          <>
            <h3 style={{ fontSize: 15, marginTop: "1.5rem" }}>{t("especes.world_reference_title")}</h3>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
              {t("especes.world_reference_explain", { country: selectedCountryName })}
            </p>
            <ScrollableTable>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("especes.table_world_group")}</th>
                    <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("especes.table_world_count")}</th>
                    <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("especes.table_world_share")}</th>
                  </tr>
                </thead>
                <tbody>
                  {globalShare.map((g) => (
                    <tr key={g.taxon_group}>
                      <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>{translateTaxonGroup(g.taxon_group, locale)}</th>
                      <td style={{ textAlign: "right", padding: 6 }}>{g.species_count != null ? g.species_count.toLocaleString(localeTag(locale)) : "—"}</td>
                      <td style={{ textAlign: "right", padding: 6 }}>{g.share_percent} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </>
        )}
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
          {t("especes.world_source")}
          {lastUpdated?.speciesThreatened?.latestYear && (
            <> {t("especes.world_source_year", { year: lastUpdated.speciesThreatened.latestYear })}</>
          )}
          .
        </p>
      </section>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
