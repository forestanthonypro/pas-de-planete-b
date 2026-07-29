import Link from "next/link";
import { useSobriety } from "../lib/SobrietyContext";

export default function Layout({ children }) {
  const { sobriety, setSobriety } = useSobriety();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "0.85rem 1.5rem",
          borderBottom: "1px solid var(--color-bordure)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--color-texte)" }}>
          {!sobriety && <span aria-hidden="true" style={{ fontSize: 20 }}>🌍</span>}
          <strong style={{ fontSize: 16 }}>Pas de planète B</strong>
        </Link>

        <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: 14 }}>
          <Link href="/co2">Environnement</Link>
          <Link href="/deputes">Démocratie</Link>
          <Link href="/debunk">S&apos;engager</Link>
        </nav>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            background: "var(--color-carte)",
            border: "1px solid var(--color-bordure)",
            borderRadius: "var(--radius)",
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          {!sobriety && <span aria-hidden="true">🌱</span>}
          Mode sobriété
          <input
            type="checkbox"
            checked={sobriety}
            onChange={(e) => setSobriety(e.target.checked)}
            aria-label="Activer le mode sobriété (réduit les animations et les visuels)"
          />
        </label>
      </header>

      <main style={{ flex: 1, width: "100%" }}>{children}</main>

      <footer
        style={{
          borderTop: "1px solid var(--color-bordure)",
          padding: "1rem 1.5rem",
          fontSize: 12,
          color: "var(--color-texte-clair)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {!sobriety && <span aria-hidden="true">🌱</span>}
        Écoconception : sources ouvertes, sans compte, sans traceurs publicitaires.
      </footer>
    </div>
  );
}
