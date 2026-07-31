import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "../../lib/useT";
import PageHeader from "../../components/PageHeader";
import { IconUsers } from "../../components/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function ParticipationPage() {
  const { t } = useT();
  const [deputies, setDeputies] = useState([]);
  const [minVotes, setMinVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/deputies/participation`)
      .then((res) => {
        if (!res.ok) throw new Error(t("deputes.error_no_data"));
        return res.json();
      })
      .then((data) => {
        setDeputies(data.deputies || []);
        setMinVotes(data.minVotes || 0);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withRate = useMemo(
    () =>
      deputies.map((d) => ({
        ...d,
        rate: Math.round((parseInt(d.active_votes, 10) / parseInt(d.total_votes, 10)) * 1000) / 10,
      })),
    [deputies]
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return withRate;
    return withRate.filter((d) => normalize(d.full_name).includes(q) || normalize(d.group_abbreviation).includes(q));
  }, [withRate, query]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconUsers} tint="blue" title={t("deputes.participation_title")} />
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>
        {t("deputes.participation_intro1", { minVotes })}
      </p>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>{t("deputes.participation_intro2")}</p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("deputes.search_name_group")}
        style={{ padding: "6px 10px", minWidth: 260, marginBottom: "1rem" }}
      />

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && filtered.length === 0 && <p>{t("deputes.no_deputies")}</p>}

      {!loading && !error && filtered.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_deputy")}</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_group")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("deputes.table_observed_scrutins")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("deputes.table_participation_rate")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.acteur_uid}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                  <Link href={`/deputes/${d.acteur_uid}`}>{d.full_name}</Link>
                </th>
                <td style={{ padding: 8 }}>{d.group_abbreviation || "—"}</td>
                <td style={{ textAlign: "right", padding: 8 }}>{d.total_votes}</td>
                <td style={{ textAlign: "right", padding: 8, fontWeight: 600 }}>{d.rate} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
        {t("deputes.participation_source")}{" "}
        <Link href="/deputes">{t("deputes.back_to_deputies_list")}</Link>
      </p>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
