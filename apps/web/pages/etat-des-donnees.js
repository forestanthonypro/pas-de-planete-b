import Link from "next/link";
import PageHeader from "../components/PageHeader";
import ScrollableTable from "../components/ScrollableTable";
import { IconLeaf } from "../components/icons";
import { useT } from "../lib/useT";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";

// Liste chaque source de données ingérée automatiquement, sa fraîcheur, et
// un lien vers la page du site qui l'utilise — renforce la confiance en
// rendant visible ce qui alimente réellement les chiffres affichés.
// Les labels viennent de t("dataStatus.source_xxx") ; seuls les codes clés
// et les liens restent en dur ici, le texte affiché est entièrement traduit.
const SOURCE_KEYS = [
  { key: "co2", labelKey: "source_co2", source: "Our World in Data", page: "/co2" },
  { key: "powerPlants", labelKey: "source_powerPlants", source: "Global Power Plant Database", page: "/energie" },
  { key: "electricity", labelKey: "source_electricity", source: "Ember / Our World in Data", page: "/energie" },
  { key: "species", labelKey: "source_species", source: "IUCN Red List", page: "/especes" },
  { key: "speciesThreatened", labelKey: "source_speciesThreatened", source: "IUCN Red List", page: "/especes" },
  { key: "vegetation", labelKey: "source_vegetation", source: "Global Forest Watch", page: "/vegetation" },
  { key: "fires", labelKey: "source_fires", source: "NASA FIRMS", page: "/incendies" },
  { key: "water", labelKey: "source_water", source: "Aqueduct / FAO", page: "/eau" },
  { key: "pollution", labelKey: "source_pollution", source: "OMS / Our World in Data", page: "/pollution" },
  { key: "worldBenchmarks", labelKey: "source_worldBenchmarks", source: "Sources agrégées", page: "/especes" },
  { key: "deputies", labelKey: "source_deputies", source: "CIVIX, Assemblée nationale", page: "/deputes" },
  { key: "anGroups", labelKey: "source_anGroups", source: "CIVIX, Assemblée nationale", page: "/groupes" },
  { key: "scrutins", labelKey: "source_scrutins", source: "CIVIX, Assemblée nationale", page: "/scrutins" },
];

function freshnessColor(lastIngested) {
  if (!lastIngested) return "#95a5a6";
  const days = (Date.now() - new Date(lastIngested).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 14) return "#1baf7a";
  if (days < 60) return "#f4b400";
  return "#d63e2a";
}

export default function EtatDesDonnees() {
  const { t } = useT();
  const lastUpdated = useLastUpdated();

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconLeaf} tint="green" title={t("dataStatus.title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>{t("dataStatus.intro")}</p>
      </PageHeader>

      {!lastUpdated ? (
        <p>{t("common.loading")}</p>
      ) : (
        <ScrollableTable>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("dataStatus.th_data")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("dataStatus.th_source")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("dataStatus.th_last_update")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_KEYS.map((s) => {
                const info = lastUpdated[s.key] || {};
                return (
                  <tr key={s.key}>
                    <td style={{ padding: 8 }}>
                      <a href={s.page} style={{ color: "var(--color-texte)" }}>
                        {t(`dataStatus.${s.labelKey}`)}
                      </a>
                    </td>
                    <td style={{ padding: 8, fontSize: 13, color: "var(--color-texte-clair)" }}>{s.source}</td>
                    <td style={{ padding: 8, fontSize: 13 }}>
                      {info.lastIngested ? formatDate(info.lastIngested) : t("dataStatus.not_available")}
                      {info.latestYear && (
                        <span style={{ color: "var(--color-texte-clair)" }}>
                          {t("dataStatus.data_year", { year: info.latestYear })}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 8 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: freshnessColor(info.lastIngested),
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#1baf7a", marginRight: 6 }} />
        {t("dataStatus.legend_fresh")} &nbsp;
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#f4b400", marginRight: 6, marginLeft: 12 }} />
        {t("dataStatus.legend_medium")} &nbsp;
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#d63e2a", marginRight: 6, marginLeft: 12 }} />
        {t("dataStatus.legend_stale")}
      </p>

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>{t("dataStatus.footer_note")}</p>
      <p style={{ fontSize: 12, marginTop: "0.5rem" }}>
        <Link href="/impact">{t("common.footer_impact")} →</Link>
      </p>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
