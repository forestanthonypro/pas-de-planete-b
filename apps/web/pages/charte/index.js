import { useEffect, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconLeaf } from "../../components/icons";
import { useT } from "../../lib/useT";
import { getAnonymousId } from "../../lib/anonymousId";

const MIN_ALTERNATIVE_LENGTH = 30;

export default function CharterPage() {
  const { t, locale } = useT();
  const [data, setData] = useState(null);
  const [myVotes, setMyVotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suggestionTitle, setSuggestionTitle] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionEmail, setSuggestionEmail] = useState("");
  const [suggestionNotes, setSuggestionNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState("idle"); // idle | sending | done | error
  const [nuancePromptItemId, setNuancePromptItemId] = useState(null);
  const [nuanceAlternative, setNuanceAlternative] = useState("");
  const [nuanceSubmitting, setNuanceSubmitting] = useState(false);
  const [declinedItemId, setDeclinedItemId] = useState(null);

  useEffect(() => {
    const anonymousId = getAnonymousId();
    Promise.all([
      fetch(`/api/charter?locale=${locale}`).then((res) => {
        if (!res.ok) throw new Error(t("charter.error_no_data"));
        return res.json();
      }),
      anonymousId ? fetch(`/api/charter-votes/${anonymousId}`).then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
    ])
      .then(([charterData, voteRows]) => {
        setData(charterData);
        const votesByItem = {};
        for (const v of voteRows) votesByItem[v.item_id] = v.vote_type;
        setMyVotes(votesByItem);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  function vote(itemId, voteType) {
    const anonymousId = getAnonymousId();
    // Mise à jour optimiste : on ajuste tout de suite les compteurs et le
    // vote affiché, sans attendre la réponse du serveur.
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) => ({
          ...s,
          items: s.items.map((item) => {
            if (item.id !== itemId) return item;
            const previousVote = myVotes[itemId];
            let adhereCount = item.adhereCount;
            let nuanceCount = item.nuanceCount;
            if (previousVote === "adhere") adhereCount -= 1;
            if (previousVote === "nuance") nuanceCount -= 1;
            if (voteType === "adhere") adhereCount += 1;
            if (voteType === "nuance") nuanceCount += 1;
            return { ...item, adhereCount, nuanceCount };
          }),
        })),
      };
    });
    setMyVotes((prev) => ({ ...prev, [itemId]: voteType }));

    fetch(`/api/charter-votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousId, itemId, voteType }),
    }).catch(() => {
      // Échec silencieux : le vote reste affiché localement, on ne casse
      // pas l'expérience pour un souci réseau ponctuel.
    });
  }

  // Cliquer sur "À nuancer" n'enregistre rien tout de suite — ça ouvre
  // d'abord un petit parcours qui encourage un retour constructif, plutôt
  // que de compter silencieusement un désaccord sans contenu.
  function openNuancePrompt(itemId) {
    setNuancePromptItemId(itemId);
    setNuanceAlternative("");
    setDeclinedItemId(null);
  }

  function closeNuancePrompt() {
    setNuancePromptItemId(null);
    setNuanceAlternative("");
  }

  function switchToAdhereFromPrompt(itemId) {
    vote(itemId, "adhere");
    closeNuancePrompt();
  }

  function declineNuancePrompt(itemId) {
    closeNuancePrompt();
    setDeclinedItemId(itemId);
  }

  function confirmNuanceWithAlternative(itemId, itemTitle) {
    if (nuanceAlternative.trim().length < MIN_ALTERNATIVE_LENGTH) return;
    setNuanceSubmitting(true);
    vote(itemId, "nuance");
    fetch(`/api/charter-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Concernant « ${itemTitle} » : ${nuanceAlternative.trim()}` }),
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
    if (!suggestionTitle.trim()) return;
    setSuggestionStatus("sending");
    // Envoyée directement comme un vrai élément de charte (non publié, en
    // attente de relecture, dans la section "Boîte à idées (à trier)")
    // plutôt qu'un texte libre à part — une fois approuvée par l'admin,
    // elle apparaît comme un vrai bloc votable (👍/🤔). Même principe que
    // débunk, paysans, pétitions et ressources.
    fetch(`/api/charter-items/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: suggestionTitle.trim(), description: suggestionText.trim() || null,
        submitterEmail: suggestionEmail || null, submissionNotes: suggestionNotes || null, website,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setSuggestionStatus("done");
        setSuggestionTitle("");
        setSuggestionText("");
        setSuggestionEmail("");
        setSuggestionNotes("");
      })
      .catch(() => setSuggestionStatus("error"));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <PageHeader Icon={IconLeaf} tint="green" title={t("charter.title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>{t("charter.intro")}</p>
      </PageHeader>

      <ShareButtons title={t("charter.share_title")} />

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && data && data.sections.length === 0 && <p>{t("charter.no_content")}</p>}

      {!loading && !error && data && data.sections.map((section) => (
        <section key={section.id} style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: 18 }}>{section.name}</h2>
          {section.items.map((item, i) => {
            const myVote = myVotes[item.id];
            return (
              <div key={item.id} className="pdpb-card" style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px", whiteSpace: "pre-line" }}>
                  {i + 1}. {item.title}
                </p>
                {item.description && (
                  <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: "0 0 10px", whiteSpace: "pre-line" }}>{item.description}</p>
                )}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => vote(item.id, "adhere")}
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
                    👍 {t("charter.vote_adhere")} · {item.adhereCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => openNuancePrompt(item.id)}
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
                    🤔 {t("charter.vote_nuance")} · {item.nuanceCount}
                  </button>
                </div>

                {nuancePromptItemId === item.id && (
                  <div style={{ marginTop: 10, padding: "0.75rem", background: "var(--color-fond)", border: "1px solid #a86b0a", borderRadius: 8 }}>
                    <p style={{ fontSize: 13, margin: "0 0 10px" }}>{t("charter.nuance_prompt")}</p>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: 10 }}>
                      <button type="button" onClick={() => switchToAdhereFromPrompt(item.id)} style={{ fontSize: 13 }}>
                        {t("charter.nuance_switch_to_yes")}
                      </button>
                      <button type="button" onClick={() => declineNuancePrompt(item.id)} style={{ fontSize: 13 }}>
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
                      onClick={() => confirmNuanceWithAlternative(item.id, item.title)}
                      disabled={nuanceAlternative.trim().length < MIN_ALTERNATIVE_LENGTH || nuanceSubmitting}
                      style={{ fontSize: 13, fontWeight: 600 }}
                    >
                      {nuanceSubmitting ? t("charter.nuance_sending") : t("charter.nuance_confirm")}
                    </button>
                  </div>
                )}

                {declinedItemId === item.id && (
                  <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginTop: 10, fontStyle: "italic" }}>
                    {t("charter.nuance_declined_message")}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      ))}

      <section style={{ marginTop: "2.5rem", background: "var(--color-carte-verte)", borderRadius: 12, padding: "1.25rem" }}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>{t("charter.propose_title")}</h2>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("charter.propose_intro")}</p>

        {suggestionStatus === "done" ? (
          <p style={{ fontSize: 14, fontWeight: 600 }}>{t("charter.propose_done")}</p>
        ) : (
          <form onSubmit={handleSuggestionSubmit}>
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
              <label htmlFor="website-charter">{t("common.honeypot_label")}</label>
              <input id="website-charter" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("charter.title_label")}</span>
              <input
                type="text"
                required
                maxLength={300}
                value={suggestionTitle}
                onChange={(e) => setSuggestionTitle(e.target.value)}
                placeholder={t("charter.title_placeholder")}
                style={{ width: "100%", padding: "8px 10px" }}
              />
            </label>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder={t("charter.propose_placeholder")}
              rows={3}
              maxLength={2000}
              style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit", marginBottom: "0.5rem" }}
            />
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
            <button type="submit" disabled={suggestionStatus === "sending" || !suggestionTitle.trim()}>
              {suggestionStatus === "sending" ? t("charter.propose_sending") : t("charter.propose_button")}
            </button>
            {suggestionStatus === "error" && (
              <p role="alert" style={{ fontSize: 13, color: "#d63e2a" }}>{t("charter.propose_error")}</p>
            )}
          </form>
        )}
      </section>

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
        <Link href="/">{t("charter.back_to_home")}</Link>
      </p>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
