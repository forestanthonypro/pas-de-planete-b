import { useEffect, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconCheck } from "../../components/icons";
import { useT } from "../../lib/useT";
import { getAnonymousId } from "../../lib/anonymousId";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function FutureIdeasPage() {
  const { t, locale } = useT();
  const [ideas, setIdeas] = useState([]);
  const [mySupports, setMySupports] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishedSuggestions, setPublishedSuggestions] = useState([]);
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState("idle"); // idle | sending | done | error

  useEffect(() => {
    const anonymousId = getAnonymousId();
    Promise.all([
      fetch(`${API_URL}/api/future-ideas?locale=${locale}`).then((res) => {
        if (!res.ok) throw new Error(t("futureIdeas.error_no_data"));
        return res.json();
      }),
      anonymousId ? fetch(`${API_URL}/api/future-idea-votes/${anonymousId}`).then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
      fetch(`${API_URL}/api/future-idea-suggestions/published`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([ideaRows, mySlugs, suggestionRows]) => {
        setIdeas(Array.isArray(ideaRows) ? ideaRows : []);
        setMySupports(new Set(mySlugs));
        setPublishedSuggestions(Array.isArray(suggestionRows) ? suggestionRows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  function toggleSupport(slug) {
    const anonymousId = getAnonymousId();
    const alreadySupported = mySupports.has(slug);

    // Mise à jour optimiste du compteur et de l'état affiché.
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.slug === slug
          ? { ...idea, support_count: idea.support_count + (alreadySupported ? -1 : 1) }
          : idea
      )
    );
    setMySupports((prev) => {
      const next = new Set(prev);
      if (alreadySupported) next.delete(slug);
      else next.add(slug);
      return next;
    });

    fetch(`${API_URL}/api/future-idea-votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousId, ideaSlug: slug }),
    }).catch(() => {
      // Échec silencieux : le soutien reste affiché localement, on ne casse
      // pas l'expérience pour un souci réseau ponctuel.
    });
  }

  const sortedIdeas = [...ideas].sort((a, b) => b.support_count - a.support_count);

  function handleSuggestionSubmit(e) {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    setSuggestionStatus("sending");
    fetch(`${API_URL}/api/future-idea-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: suggestionText.trim() }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setSuggestionStatus("done");
        setSuggestionText("");
      })
      .catch(() => setSuggestionStatus("error"));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <PageHeader Icon={IconCheck} tint="blue" title={t("futureIdeas.title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>{t("futureIdeas.intro")}</p>
      </PageHeader>

      <ShareButtons title={t("futureIdeas.share_title")} />

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && sortedIdeas.length === 0 && <p>{t("futureIdeas.no_ideas")}</p>}

      {!loading && !error && sortedIdeas.map((idea) => {
        const supported = mySupports.has(idea.slug);
        return (
          <div key={idea.slug} className="pdpb-card" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{idea.title}</p>
              {idea.description && (
                <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>{idea.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleSupport(idea.slug)}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 20,
                border: supported ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
                background: supported ? "var(--color-carte-verte)" : "var(--color-fond)",
                color: "var(--color-texte)",
                fontWeight: supported ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {supported ? `✓ ${t("futureIdeas.supported_button")}` : t("futureIdeas.support_button")}
              <br />
              <span style={{ fontSize: 17, fontWeight: 700 }}>{idea.support_count}</span>
            </button>
          </div>
        );
      })}

      {!loading && !error && publishedSuggestions.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: 18 }}>{t("futureIdeas.suggestions_title")}</h2>
          <ul>
            {publishedSuggestions.map((s) => (
              <li key={s.id} style={{ fontSize: 14, marginBottom: 6 }}>{s.text}</li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: "2.5rem", background: "var(--color-carte-verte)", borderRadius: 12, padding: "1.25rem" }}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>{t("futureIdeas.propose_title")}</h2>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("futureIdeas.propose_intro")}</p>

        {suggestionStatus === "done" ? (
          <p style={{ fontSize: 14, fontWeight: 600 }}>{t("futureIdeas.propose_done")}</p>
        ) : (
          <form onSubmit={handleSuggestionSubmit}>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder={t("futureIdeas.propose_placeholder")}
              rows={3}
              maxLength={2000}
              style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit", marginBottom: "0.5rem" }}
            />
            <button type="submit" disabled={suggestionStatus === "sending" || !suggestionText.trim()}>
              {suggestionStatus === "sending" ? t("futureIdeas.propose_sending") : t("futureIdeas.propose_button")}
            </button>
            {suggestionStatus === "error" && (
              <p role="alert" style={{ fontSize: 13, color: "#d63e2a" }}>{t("futureIdeas.propose_error")}</p>
            )}
          </form>
        )}
      </section>

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
        <Link href="/">{t("futureIdeas.back_to_home")}</Link>
      </p>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
