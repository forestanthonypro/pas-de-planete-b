import { useEffect, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import ScopeMultiSelect from "../../components/ScopeMultiSelect";
import ScopeBadges from "../../components/ScopeBadges";
import { IconCheck } from "../../components/icons";
import { useT } from "../../lib/useT";
import { getAnonymousId } from "../../lib/anonymousId";

const MIN_ALTERNATIVE_LENGTH = 30;

export default function FutureIdeasPage() {
  const { t, locale } = useT();
  const [ideas, setIdeas] = useState([]);
  const [myVotes, setMyVotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishedSuggestions, setPublishedSuggestions] = useState([]);
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionScopeCodes, setSuggestionScopeCodes] = useState([]);
  const [suggestionEmail, setSuggestionEmail] = useState("");
  const [suggestionNotes, setSuggestionNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState("idle"); // idle | sending | done | error
  const [nuancePromptSlug, setNuancePromptSlug] = useState(null);
  const [nuanceAlternative, setNuanceAlternative] = useState("");
  const [nuanceSubmitting, setNuanceSubmitting] = useState(false);
  const [declinedSlug, setDeclinedSlug] = useState(null);

  useEffect(() => {
    const anonymousId = getAnonymousId();
    Promise.all([
      fetch(`/api/future-ideas?locale=${locale}`).then((res) => {
        if (!res.ok) throw new Error(t("futureIdeas.error_no_data"));
        return res.json();
      }),
      anonymousId ? fetch(`/api/future-idea-votes/${anonymousId}`).then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
      fetch(`/api/future-idea-suggestions/published`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([ideaRows, voteRows, suggestionRows]) => {
        setIdeas(Array.isArray(ideaRows) ? ideaRows : []);
        const votesBySlug = {};
        for (const v of voteRows) votesBySlug[v.idea_slug] = v.vote_type;
        setMyVotes(votesBySlug);
        setPublishedSuggestions(Array.isArray(suggestionRows) ? suggestionRows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  function vote(slug, voteType) {
    const anonymousId = getAnonymousId();
    // Mise à jour optimiste : on ajuste tout de suite les compteurs et le
    // vote affiché, sans attendre la réponse du serveur — même principe
    // que la charte.
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.slug !== slug) return idea;
        const previousVote = myVotes[slug];
        let adhereCount = idea.adhere_count;
        let nuanceCount = idea.nuance_count;
        if (previousVote === "adhere") adhereCount -= 1;
        if (previousVote === "nuance") nuanceCount -= 1;
        if (voteType === "adhere") adhereCount += 1;
        if (voteType === "nuance") nuanceCount += 1;
        return { ...idea, adhere_count: adhereCount, nuance_count: nuanceCount };
      })
    );
    setMyVotes((prev) => ({ ...prev, [slug]: voteType }));

    fetch(`/api/future-idea-votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousId, ideaSlug: slug, voteType }),
    }).catch(() => {
      // Échec silencieux : le vote reste affiché localement, on ne casse
      // pas l'expérience pour un souci réseau ponctuel.
    });
  }

  // Cliquer sur "À nuancer" n'enregistre rien tout de suite — ça ouvre
  // d'abord un petit parcours qui encourage un retour constructif, plutôt
  // que de compter silencieusement un désaccord sans contenu. Identique à
  // la charte.
  function openNuancePrompt(slug) {
    setNuancePromptSlug(slug);
    setNuanceAlternative("");
    setDeclinedSlug(null);
  }

  function closeNuancePrompt() {
    setNuancePromptSlug(null);
    setNuanceAlternative("");
  }

  function switchToAdhereFromPrompt(slug) {
    vote(slug, "adhere");
    closeNuancePrompt();
  }

  function declineNuancePrompt(slug) {
    closeNuancePrompt();
    setDeclinedSlug(slug);
  }

  function confirmNuanceWithAlternative(slug, ideaTitle) {
    if (nuanceAlternative.trim().length < MIN_ALTERNATIVE_LENGTH) return;
    setNuanceSubmitting(true);
    vote(slug, "nuance");
    fetch(`/api/future-idea-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Concernant « ${ideaTitle} » : ${nuanceAlternative.trim()}` }),
    })
      .then(() => {
        setNuanceSubmitting(false);
        closeNuancePrompt();
      })
      .catch(() => {
        // Le vote est déjà enregistré ; seule la proposition d'alternative
        // a échoué à partir — on referme quand même plutôt que bloquer la
        // personne sur un souci réseau ponctuel.
        setNuanceSubmitting(false);
        closeNuancePrompt();
      });
  }

  function handleSuggestionSubmit(e) {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    setSuggestionStatus("sending");
    fetch(`/api/future-idea-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: suggestionText.trim(), scopeCodes: suggestionScopeCodes,
        submitterEmail: suggestionEmail || null, submissionNotes: suggestionNotes || null, website,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setSuggestionStatus("done");
        setSuggestionText("");
        setSuggestionScopeCodes([]);
        setSuggestionEmail("");
        setSuggestionNotes("");
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
      {!loading && !error && ideas.length === 0 && <p>{t("futureIdeas.no_ideas")}</p>}

      {!loading && !error && ideas.map((idea, i) => {
        const myVote = myVotes[idea.slug];
        return (
          <div key={idea.slug} className="pdpb-card" style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px", whiteSpace: "pre-line" }}>
              {i + 1}. {idea.title}{" "}
              {idea.scope_codes && idea.scope_codes.length > 0 && <ScopeBadges codes={idea.scope_codes} locale={locale} />}
            </p>
            {idea.description && (
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: "0 0 10px", whiteSpace: "pre-line" }}>
                {idea.description}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => vote(idea.slug, "adhere")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: myVote === "adhere" ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
                  background: myVote === "adhere" ? "var(--color-carte-verte)" : "var(--color-fond)",
                  color: "var(--color-texte)",
                  fontWeight: myVote === "adhere" ? 600 : 400,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                👍 {t("charter.vote_adhere")} · {idea.adhere_count}
              </button>
              <button
                type="button"
                onClick={() => openNuancePrompt(idea.slug)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: myVote === "nuance" ? "2px solid #a86b0a" : "1px solid var(--color-bordure)",
                  background: myVote === "nuance" ? "#fdf1d6" : "var(--color-fond)",
                  color: myVote === "nuance" ? "#3d2c05" : "var(--color-texte)",
                  fontWeight: myVote === "nuance" ? 600 : 400,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                🤔 {t("charter.vote_nuance")} · {idea.nuance_count}
              </button>
            </div>

            {nuancePromptSlug === idea.slug && (
              <div style={{ marginTop: 10, padding: "0.75rem", background: "var(--color-fond)", border: "1px solid #a86b0a", borderRadius: 8 }}>
                <p style={{ fontSize: 13, margin: "0 0 10px" }}>{t("charter.nuance_prompt")}</p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: 10 }}>
                  <button type="button" onClick={() => switchToAdhereFromPrompt(idea.slug)} style={{ fontSize: 13 }}>
                    {t("charter.nuance_switch_to_yes")}
                  </button>
                  <button type="button" onClick={() => declineNuancePrompt(idea.slug)} style={{ fontSize: 13 }}>
                    {t("charter.nuance_decline")}
                  </button>
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 4px" }}>{t("charter.nuance_alternative_label")}</p>
                <textarea
                  value={nuanceAlternative}
                  onChange={(e) => setNuanceAlternative(e.target.value)}
                  placeholder={t("charter.nuance_alternative_placeholder")}
                  rows={4}
                  maxLength={2000}
                  style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit", marginBottom: 4 }}
                />
                <p style={{ fontSize: 12, color: nuanceAlternative.trim().length < MIN_ALTERNATIVE_LENGTH ? "var(--color-texte-clair)" : "#1baf7a", margin: "0 0 8px" }}>
                  {t("charter.nuance_char_count", { count: nuanceAlternative.trim().length, min: MIN_ALTERNATIVE_LENGTH })}
                </p>
                <button
                  type="button"
                  onClick={() => confirmNuanceWithAlternative(idea.slug, idea.title)}
                  disabled={nuanceAlternative.trim().length < MIN_ALTERNATIVE_LENGTH || nuanceSubmitting}
                  style={{ fontSize: 13, fontWeight: 600 }}
                >
                  {nuanceSubmitting ? t("charter.nuance_sending") : t("charter.nuance_confirm")}
                </button>
              </div>
            )}

            {declinedSlug === idea.slug && (
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginTop: 10, fontStyle: "italic" }}>
                {t("charter.nuance_declined_message")}
              </p>
            )}
          </div>
        );
      })}

      {!loading && !error && publishedSuggestions.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: 18 }}>{t("futureIdeas.suggestions_title")}</h2>
          <ul>
            {publishedSuggestions.map((s) => (
              <li key={s.id} style={{ fontSize: 14, marginBottom: 6, whiteSpace: "pre-line" }}>
                {s.text} {s.scope_codes && s.scope_codes.length > 0 && <ScopeBadges codes={s.scope_codes} locale={locale} />}
              </li>
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
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
              <label htmlFor="website-future-idea">{t("common.honeypot_label")}</label>
              <input id="website-future-idea" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder={t("futureIdeas.propose_placeholder")}
              rows={3}
              maxLength={2000}
              style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit", marginBottom: "0.5rem" }}
            />
            <div style={{ marginBottom: "0.75rem" }}>
              <ScopeMultiSelect
                value={suggestionScopeCodes}
                onChange={setSuggestionScopeCodes}
                locale={locale}
                label={t("futureIdeas.scope_label")}
                placeholder={t("common.country_search_placeholder")}
              />
            </div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("futureIdeas.email_label")}</span>
              <input
                type="email"
                value={suggestionEmail}
                onChange={(e) => setSuggestionEmail(e.target.value)}
                placeholder={t("futureIdeas.email_placeholder")}
                style={{ width: "100%", padding: "8px 10px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("futureIdeas.notes_label")}</span>
              <textarea
                value={suggestionNotes}
                onChange={(e) => setSuggestionNotes(e.target.value)}
                rows={2}
                style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }}
              />
            </label>
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
