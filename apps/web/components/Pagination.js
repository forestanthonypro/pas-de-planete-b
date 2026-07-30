import { useT } from "../lib/useT";

// Pagination réutilisable : première page, précédent, quelques numéros
// autour de la page actuelle, suivant, dernière page. Se masque toute seule
// s'il n'y a qu'une seule page.
export default function Pagination({ page, totalPages, onChange }) {
  const { t } = useT();
  if (totalPages <= 1) return null;

  // Construit une liste de numéros à afficher avec des "…" pour les trous,
  // en gardant toujours la première, la dernière, et quelques pages autour
  // de la page actuelle.
  const pages = [];
  const windowSize = 1;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= windowSize) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  function btnStyle(active) {
    return {
      minWidth: 32,
      padding: "6px 8px",
      borderRadius: 6,
      border: active ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
      background: active ? "var(--color-carte-verte)" : "var(--color-carte)",
      color: "var(--color-texte)",
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      fontSize: 13,
    };
  }

  return (
    <nav
      aria-label={t("common.pagination_label")}
      style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: "1.25rem" }}
    >
      <button type="button" onClick={() => onChange(1)} disabled={page === 1} style={btnStyle(false)}>
        « {t("common.pagination_first")}
      </button>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} style={btnStyle(false)}>
        ‹
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} style={{ padding: "0 4px", color: "var(--color-texte-clair)" }}>…</span>
        ) : (
          <button key={p} type="button" onClick={() => onChange(p)} style={btnStyle(p === page)}>
            {p}
          </button>
        )
      )}

      <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} style={btnStyle(false)}>
        ›
      </button>
      <button type="button" onClick={() => onChange(totalPages)} disabled={page === totalPages} style={btnStyle(false)}>
        {t("common.pagination_last")} »
      </button>
    </nav>
  );
}
