import { useSobriety } from "../lib/SobrietyContext";

// En-tête de page cohérent avec les pastilles colorées de l'accueil — pour
// que l'identité visuelle du "modèle Nature épurée" se retrouve partout,
// pas seulement sur la page d'accueil. Les couleurs sont les mêmes teintes
// que sur l'accueil (voir TINTS dans pages/index.js).
const TINTS = {
  green: { bg: "#eaf3de", color: "#1b5e20" },
  amber: { bg: "#fdf1d6", color: "#a86b0a" },
  blue: { bg: "#e3eef7", color: "#0b3c5d" },
  tan: { bg: "#f3e9dd", color: "#8a5a2b" },
  red: { bg: "#fbe4de", color: "#b0401f" },
  mauve: { bg: "#ece5f2", color: "#5c3d7a" },
  teal: { bg: "#dcf2ee", color: "#0f6e56" },
};

export default function PageHeader({ Icon, tint = "green", title, children }) {
  const { sobriety } = useSobriety();
  const colors = TINTS[tint] || TINTS.green;

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: children ? 6 : 0 }}>
        {!sobriety && Icon && (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: colors.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={20} style={{ color: colors.color }} />
          </div>
        )}
        <h1 style={{ margin: 0 }}>{title}</h1>
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}
