import Link from "next/link";

// Page 404 personnalisée — remplace celle générée automatiquement par
// Next.js. Volontairement autonome (pas de Layout, pas de useT, pas de
// useRouter) : les pages 404/500 sont toujours générées statiquement par
// Next.js quel que soit le contexte, donc elles doivent pouvoir s'afficher
// sans aucune dépendance au contexte de la page qui a échoué.
export default function Custom404() {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: "0.5rem" }}>Page introuvable</h1>
      <p style={{ fontSize: 15, color: "#666", marginBottom: "1.5rem" }}>
        Cette page n&apos;existe pas ou plus.
      </p>
      <Link href="/" style={{ fontSize: 15, color: "#1b5e20", fontWeight: 600 }}>
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
