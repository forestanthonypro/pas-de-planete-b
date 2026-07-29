import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function DeputesPage() {
  const { t } = useT();
  const [deputies, setDeputies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof router.query.groupe === "string") setGroupFilter(router.query.groupe);
  }, [router.query.groupe]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/deputies`)
      .then((res) => {
        if (!res.ok) throw new Error(t("deputes.error_no_data"));
        return res.json();
      })
      .then((rows) => {
        setDeputies(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    const set = new Set(deputies.map((d) => d.group_abbreviation).filter(Boolean));
    return [...set].sort();
  }, [deputies]);

  const departments = useMemo(() => {
    const set = new Set(deputies.map((d) => d.department).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [deputies]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return deputies.filter((d) => {
      if (groupFilter && d.group_abbreviation !== groupFilter) return false;
      if (departmentFilter && d.department !== departmentFilter) return false;
      if (!q) return true;
      return normalize(d.full_name).includes(q) || normalize(d.department).includes(q);
    });
  }, [deputies, query, groupFilter, departmentFilter]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>{t("deputes.title")}</h1>
      <ShareButtons title={t("deputes.title")} />

      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        {t("deputes.list_intro", { count: deputies.length || "…" })}
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("deputes.search_placeholder")}
          style={{ padding: "6px 10px", minWidth: 260 }}
        />
        <label>
          {t("deputes.group_label")}{" "}
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">{t("deputes.all")}</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label>
          {t("deputes.department_label")}{" "}
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">{t("deputes.all")}</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && filtered.length === 0 && <p>{t("deputes.no_deputies")}</p>}

      {!loading && !error && filtered.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_name")}</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_group")}</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_department")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.acteur_uid}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                  <Link href={`/deputes/${d.acteur_uid}`}>{d.full_name}</Link>
                </th>
                <td style={{ padding: 8 }}>{d.group_abbreviation || "—"}</td>
                <td style={{ padding: 8 }}>
                  {d.department ? `${d.department}${d.circo_number ? t("deputes.circo_suffix", { n: d.circo_number }) : ""}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 13, color: "#666", marginTop: "1.5rem" }}>
        {t("deputes.coverage_note")}{" "}
        <a href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
          data.assemblee-nationale.fr
        </a>.
      </p>

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        {t("deputes.source")}{" "}
        <Link href="/deputes/participation">{t("deputes.participation_link")}</Link> ·{" "}
        <Link href="/scrutins">{t("deputes.scrutins_link")}</Link>
      </p>
    </div>
  );
}
