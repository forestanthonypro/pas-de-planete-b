import { useState, useEffect } from "react";
import { useSobriety } from "../lib/SobrietyContext";

const RANKING_ITEMS = [
  { key: "avion", rank: 1 },
  { key: "voiture", rank: 2 },
  { key: "boeuf", rank: 3 },
  { key: "streaming", rank: 4 },
];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function RankingQuiz({ t }) {
  const { sobriety } = useSobriety();
  // Ordre stable (non mélangé) au premier rendu — identique sur le serveur
  // et sur le client, donc pas de décalage d'hydratation. Le mélange
  // n'intervient qu'après le montage, exclusivement côté client : voir
  // le commit qui a corrigé l'erreur d'hydratation React #418 (16 août
  // 2026) pour le détail du raisonnement.
  const [shuffled, setShuffled] = useState(RANKING_ITEMS);
  useEffect(() => {
    setShuffled(shuffle(RANKING_ITEMS));
  }, []);
  const [userOrder, setUserOrder] = useState([]);
  const [revealed, setRevealed] = useState(false);

  function pick(item) {
    if (revealed || userOrder.includes(item.key)) return;
    const next = [...userOrder, item.key];
    setUserOrder(next);
    if (next.length === RANKING_ITEMS.length) setRevealed(true);
  }

  function unpick(key) {
    setUserOrder((prev) => prev.filter((k) => k !== key));
  }

  function reset() {
    setUserOrder([]);
    setRevealed(false);
  }

  const remaining = shuffled.filter((item) => !userOrder.includes(item.key));

  return (
    <div>
      {!revealed && (
        <>
          <p style={{ fontSize: 14, color: "var(--color-texte-clair)", marginBottom: 10 }}>
            {t("decouverte.ranking_intro")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: userOrder.length ? 16 : 0 }}>
            {remaining.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => pick(item)}
                style={
                  sobriety
                    ? {
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 0",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid var(--color-bordure)",
                        cursor: "pointer",
                        fontSize: 14,
                        color: "var(--color-forest)",
                        textDecoration: "underline",
                      }
                    : {
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        background: "var(--color-carte)",
                        border: "1px solid var(--color-bordure)",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        color: "var(--color-texte)",
                      }
                }
              >
                {t(`decouverte.ranking_item_${item.key}`)}
              </button>
            ))}
          </div>
          {userOrder.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>
                {t("decouverte.ranking_your_order")}
              </p>
              {userOrder.map((key, i) => {
                const item = RANKING_ITEMS.find((r) => r.key === key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => unpick(key)}
                    title={t("decouverte.ranking_undo_hint")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 14px",
                      fontSize: 13,
                      color: "var(--color-texte-clair)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{i + 1}</span>
                    {t(`decouverte.ranking_item_${item.key}`)}
                    <span style={{ marginLeft: "auto", fontSize: 12 }}>✕</span>
                  </button>
                );
              })}
            </>
          )}
        </>
      )}

      {revealed && (
        <>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", marginBottom: 10 }}>
            {t("decouverte.ranking_correct_order")}
          </p>
          {RANKING_ITEMS.slice()
            .sort((a, b) => a.rank - b.rank)
            .map((item) => {
              const userPosition = userOrder.indexOf(item.key) + 1;
              const wasCorrect = userPosition === item.rank;
              return (
                <div
                  key={item.key}
                  style={
                    sobriety
                      ? { padding: "8px 0", borderBottom: "1px solid var(--color-bordure)" }
                      : { background: "var(--color-carte)", borderRadius: 8, padding: "10px 14px", marginBottom: 6 }
                  }
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.rank}</span>
                    <span style={{ fontSize: 14, flex: 1, color: "var(--color-texte)" }}>{t(`decouverte.ranking_item_${item.key}`)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-texte)" }}>{t(`decouverte.ranking_value_${item.key}`)}</span>
                    <span style={{ fontSize: 13 }}>{wasCorrect ? "✓" : "—"}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "6px 0 0" }}>
                    {t(`decouverte.ranking_source_${item.key}`)}
                  </p>
                </div>
              );
            })}
          <button
            type="button"
            onClick={reset}
            style={
              sobriety
                ? { marginTop: 8, background: "none", border: "none", padding: 0, fontSize: 13, cursor: "pointer", color: "var(--color-forest)", textDecoration: "underline" }
                : { marginTop: 8, background: "none", border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "var(--color-texte)" }
            }
          >
            {t("decouverte.ranking_reset")}
          </button>
        </>
      )}
    </div>
  );
}
