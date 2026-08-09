import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../../components/ShareButtons";
import PageHeader from "../../../components/PageHeader";
import Pagination from "../../../components/Pagination";
import SearchableSelect from "../../../components/SearchableSelect";
import { IconUsers } from "../../../components/icons";
import { useT } from "../../../lib/useT";
import ScrollableTable from "../../../components/ScrollableTable";
import { useApiFetch } from "../../../lib/useApiFetch";
import { chamberLabelKey } from "../../../lib/parliamentChamberLabels";
import { translatePartyName } from "../../../lib/partyNameLabels";

const PAGE_SIZE = 30;

function normalize(str) {
  return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function InternationalMembersPage() {
  const { t } = useT();
  const router = useRouter();
  const { country } = router.query;
  const [query, setQuery] = useState("");
  const [chamberFilter, setChamberFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error } = useApiFetch(country ? `/api/parliament/${country}/members` : null, {
    errorMessage: t("international.error_no_data"),
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const members = useMemo(() => data ?? [], [data]);

  const groups = useMemo(() => {
    const set = new Set(members.map((m) => m.group_slug).filter(Boolean));
    return [...set];
  }, [members]);
  const groupOptions = useMemo(
    () => groups.map((slug) => ({ value: slug, label: translatePartyName(members.find((m) => m.group_slug === slug)?.group_name, t) || slug })),
    [groups, members]
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    return members.filter((m) => {
      if (chamberFilter && m.chamber !== chamberFilter) return false;
      if (groupFilter && m.group_slug !== groupFilter) return false;
      if (!q) return true;
      return normalize(m.full_name).includes(q) || normalize(m.state_or_region).includes(q);
    });
  }, [members, query, chamberFilter, groupFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, chamberFilter, groupFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!country) return null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href={`/international/${country}`}>{t("international.back_to_hub")}</Link>
      </p>
      <PageHeader Icon={IconUsers} tint="blue" title={t(`international.country_${country}`)} />
      <ShareButtons title={t(`international.country_${country}`)} />
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>
        {t("international.members_intro", { count: members.length || "…" })}
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("international.search_placeholder")}
          style={{ padding: "6px 10px", width: "100%", maxWidth: 260 }}
        />
        <SearchableSelect
          options={[
            { value: "lower", label: t(chamberLabelKey(country, "lower")) },
            { value: "upper", label: t(chamberLabelKey(country, "upper")) },
          ]}
          value={chamberFilter}
          onChange={setChamberFilter}
          label={t("international.chamber_label")}
          placeholder={t("international.chamber_label")}
          allLabel={t("deputes.all")}
          noResultsLabel={t("common.no_results")}
        />
        <SearchableSelect
          options={groupOptions}
          value={groupFilter}
          onChange={setGroupFilter}
          label={t("international.group_label")}
          placeholder={t("international.group_label")}
          allLabel={t("deputes.all")}
          noResultsLabel={t("common.no_results")}
        />
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && filtered.length === 0 && <p>{t("international.no_members")}</p>}
      {!loading && !error && filtered.length > 0 && (
        <ScrollableTable>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_name")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("international.table_chamber")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_group")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("international.table_region")}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((m) => (
                <tr key={m.id}>
                  <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                    <Link href={`/international/${country}/elus/${m.external_id}`}>{m.full_name}</Link>
                  </th>
                  <td style={{ padding: 8 }}>{t(chamberLabelKey(country, m.chamber))}</td>
                  <td style={{ padding: 8, color: m.group_color || "var(--color-texte)" }}>{translatePartyName(m.group_name, t) || "—"}</td>
                  <td style={{ padding: 8 }}>{m.state_or_region || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}
      {!loading && !error && filtered.length > PAGE_SIZE && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
        <Link href={`/international/${country}/groupes`}>{t("international.groups_link")}</Link>{" "}·{" "}
        <Link href={`/international/${country}/scrutins`}>{t("international.votes_link")}</Link>
      </p>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
