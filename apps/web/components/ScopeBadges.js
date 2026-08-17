import { scopeFlag, scopeLabel } from "../lib/scopes";

// Affichage compact des drapeaux sur un encart (carte pétition, ressource,
// idée, entrée debunk...) — jusqu'à `max` drapeaux, puis un "+N" pour le
// reste plutôt que de surcharger l'encart. Le survol (title) donne la
// liste complète en toutes lettres.
export default function ScopeBadges({ codes, locale, max = 4 }) {
  if (!codes || codes.length === 0) return null;
  const shown = codes.slice(0, max);
  const remaining = codes.length - shown.length;
  const fullList = codes.map((c) => scopeLabel(c, locale)).join(", ");

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 14 }} title={fullList}>
      {shown.map((c) => (
        <span key={c} aria-hidden="true">
          {scopeFlag(c)}
        </span>
      ))}
      {remaining > 0 && <span style={{ fontSize: 11, color: "var(--color-texte-clair)" }}>+{remaining}</span>}
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>{fullList}</span>
    </span>
  );
}
