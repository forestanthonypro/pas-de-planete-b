import { useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ShareButtons from "../../../components/ShareButtons";
import PageHeader from "../../../components/PageHeader";
import { IconLandmark } from "../../../components/icons";
import { useT } from "../../../lib/useT";
import ScrollableTable from "../../../components/ScrollableTable";
import { useApiFetch } from "../../../lib/useApiFetch";
import { chamberLabelKey } from "../../../lib/parliamentChamberLabels";
import { translatePartyName } from "../../../lib/partyNameLabels";

export default function InternationalGroupsPage() {
  const { t } = useT();
  const router = useRouter();
  const { country } = router.query;
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const { data, loading, error } = useApiFetch(country ? `/api/parliament/${country}/groups` : null, {
    errorMessage: t("international.error_no_data"),
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const groups = data ?? [];

  // Bicaméral (Chambre ET Sénat avec des élus dans les deux) : on distingue
  // les deux chambres plutôt que d'afficher un seul total mélangé — sans
  // ça, la répartition Chambre/Sénat, souvent différente, serait invisible.
  const isBicameral = groups.some((g) => Number(g.lower_count) > 0) && groups.some((g) => Number(g.upper_count) > 0);

  useEffect(() => {
    if (groups.length === 0) return;
    let cancelled = false;
    import("../../../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const sorted = [...groups].sort((a, b) => (b.member_count || 0) - (a.member_count || 0));

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: sorted.map((g) => translatePartyName(g.name, t)),
          datasets: isBicameral
            ? [
                { label: t(chamberLabelKey(country, "lower")), data: sorted.map((g) => g.lower_count), backgroundColor: sorted.map((g) => g.color || "#6c3483") },
                { label: t(chamberLabelKey(country, "upper")), data: sorted.map((g) => g.upper_count), backgroundColor: sorted.map((g) => (g.color ? `${g.color}99` : "#6c348399") ) },
              ]
            : [{ label: t("international.chart_members_label"), data: sorted.map((g) => g.member_count), backgroundColor: sorted.map((g) => g.color || "#6c3483") }],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: isBicameral, position: "bottom" } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, isBicameral]);

  if (!country) return null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href={`/international/${country}`}>{t("international.back_to_hub")}</Link>
      </p>
      <PageHeader Icon={IconLandmark} tint="blue" title={t("international.card_groups_label")} />
      <ShareButtons title={t("international.card_groups_label")} />
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>
        {t(`international.country_${country}`)}
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && groups.length > 0 && (
        <>
          <div style={{ position: "relative", height: Math.max(240, groups.length * (isBicameral ? 50 : 34)) }}>
            <canvas ref={canvasRef} role="img" aria-label={t("international.chart_members_label")} />
          </div>

          <ScrollableTable>
            <table style={{ width: "100%", minWidth: isBicameral ? 620 : 480, borderCollapse: "collapse", marginTop: "1.5rem" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_group")}</th>
                  {isBicameral ? (
                    <>
                      <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t(chamberLabelKey(country, "lower"))}</th>
                      <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t(chamberLabelKey(country, "upper"))}</th>
                      <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("international.table_effectif")} ({t("international.total_label")})</th>
                    </>
                  ) : (
                    <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("international.table_effectif")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {groups
                  .sort((a, b) => (b.member_count || 0) - (a.member_count || 0))
                  .map((g) => (
                    <tr key={g.slug}>
                      <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400, color: g.color || "var(--color-texte)" }}>
                        {translatePartyName(g.name, t)}
                      </th>
                      {isBicameral ? (
                        <>
                          <td style={{ textAlign: "right", padding: 8 }}>{g.lower_count ?? 0}</td>
                          <td style={{ textAlign: "right", padding: 8 }}>{g.upper_count ?? 0}</td>
                          <td style={{ textAlign: "right", padding: 8, fontWeight: 600 }}>{g.member_count ?? 0}</td>
                        </>
                      ) : (
                        <td style={{ textAlign: "right", padding: 8 }}>{g.member_count ?? "—"}</td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </ScrollableTable>
        </>
      )}

      {!loading && !error && groups.length === 0 && <p>{t("international.no_members")}</p>}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
