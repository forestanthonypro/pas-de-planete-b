import { useEffect, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconLeaf } from "../../components/icons";
import { useT } from "../../lib/useT";
import { getAnonymousId } from "../../lib/anonymousId";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function CharterPage() {
  const { t } = useT();
  const [data, setData] = useState(null);
  const [myVotes, setMyVotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState("idle"); // idle | sending | done | error

  useEffect(() => {
    const anonymousId = getAnonymousId();
    Promise.all([
      fetch(`${API_URL}/api/charter`).then((res) => {
        if (!res.ok) throw new Error(t("charter.error_no_data"));
        return res.json();
      }),
      anonymousId ? fetch(`${API_URL}/api/charter-votes/${anonymousId}`).then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
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
  }, []);

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

    fetch(`${API_URL}/api/charter-votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousId, itemId, voteType }),
    }).catch(() => {
      // Échec silencieux : le vote reste affiché localement, on ne casse
      // pas l'expérience pour un souci réseau ponctuel.
    });
  }

  function handleSuggestionSubmit(e) {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    setSuggestionStatus("sending");
    fetch(`${API_URL}/api/charter-suggestions`, {
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
                <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>
                  {i + 1}. {item.title}
                </p>
                {item.description && (
                  <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: "0 0 10px" }}>{item.description}</p>
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
                    onClick={() => vote(item.id, "nuance")}
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
              </div>
            );
          })}
        </section>
      ))}

      {!loading && !error && data && data.publishedSuggestions.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: 18 }}>{t("charter.suggestions_title")}</h2>
          <ul>
            {data.publishedSuggestions.map((s) => (
              <li key={s.id} style={{ fontSize: 14, marginBottom: 6 }}>{s.text}</li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: "2.5rem", background: "var(--color-carte-verte)", borderRadius: 12, padding: "1.25rem" }}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>{t("charter.propose_title")}</h2>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("charter.propose_intro")}</p>

        {suggestionStatus === "done" ? (
          <p style={{ fontSize: 14, fontWeight: 600 }}>{t("charter.propose_done")}</p>
        ) : (
          <form onSubmit={handleSuggestionSubmit}>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder={t("charter.propose_placeholder")}
              rows={3}
              maxLength={2000}
              style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit", marginBottom: "0.5rem" }}
            />
            <button type="submit" disabled={suggestionStatus === "sending" || !suggestionText.trim()}>
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
