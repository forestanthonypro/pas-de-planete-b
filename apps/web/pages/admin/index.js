import Link from "next/link";

const SECTIONS = [
  {
    title: "Débunk",
    description: "Idées reçues démontées, avec verdict et sources.",
    href: "/admin/debunk",
    icon: "🔍",
  },
  {
    title: "Relais scientifique",
    description: "Interviews, articles, vidéos et podcasts de scientifiques.",
    href: "/admin/interviews",
    icon: "🎙",
  },
  {
    title: "On devient tous paysans",
    description: "Ressources pratiques (vidéo, article, podcast, document) par catégorie.",
    href: "/admin/paysans",
    icon: "🌱",
  },
  {
    title: "Ressources",
    description: "Lieux physiques (carte) et plateformes en ligne (troc, échange...).",
    href: "/admin/ressources",
    icon: "📍",
  },
  {
    title: "Charte éthique",
    description: "Sections, éléments numérotés et réordonnables, boîte à idées modérée.",
    href: "/admin/charte",
    icon: "📜",
  },
  {
    title: "Les enfants d'aujourd'hui et de demain",
    description: "Idées à soutenir par le vote, classées par popularité.",
    href: "/admin/idees-enfants",
    icon: "🌍",
  },
];

// Point d'entrée unique pour toute l'administration éditoriale — évite
// d'avoir à retenir chaque URL /admin/... séparément. Même jeton partagé
// partout, réservé à la rédaction du site.
export default function AdminHub() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Administration</h1>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1.5rem" }}>
        Toutes les rubriques éditoriales du site, réunies ici. Même jeton d&apos;administration
        partout (disponible dans <code>.env</code>, ligne <code>INGEST_TOKEN</code>).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{ display: "block", background: "var(--color-carte)", border: "1px solid var(--color-bordure)", borderRadius: 12, padding: "1rem", textDecoration: "none", color: "inherit" }}
          >
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 4px" }}>{s.title}</p>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
