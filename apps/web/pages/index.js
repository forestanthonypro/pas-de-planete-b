import { useEffect, useState } from "react";
import Link from "next/link";
import { detectDefaultCountry } from "../lib/detectCountry";
import ActionCTA from "../components/ActionCTA";
import { useSobriety } from "../lib/SobrietyContext";

const ENVIRONMENT_CARDS = [
  { href: "/co2", emoji: "☁️", label: "CO2", desc: "Par pays" },
  { href: "/energie", emoji: "⚡", label: "Énergie", desc: "Mix électrique" },
  { href: "/eau", emoji: "💧", label: "Eau", desc: "Stress hydrique" },
  { href: "/vegetation", emoji: "🌳", label: "Végétation", desc: "Perte de forêt" },
  { href: "/especes", emoji: "🐾", label: "Espèces", desc: "Menacées (UICN)" },
  { href: "/incendies", emoji: "🔥", label: "Incendies", desc: "Détections récentes" },
  { href: "/pollution", emoji: "🌫️", label: "Pollution", desc: "PM2.5" },
];

const DEMOCRACY_CARDS = [
  { href: "/deputes", emoji: "👥", label: "Députés", desc: "577 en mandat" },
  { href: "/groupes", emoji: "🏛️", label: "Groupes", desc: "Participation, cohésion" },
  { href: "/scrutins", emoji: "⚖️", label: "Scrutins", desc: "8434 votes publics" },
];

function Card({ href, emoji, label, desc }) {
  const { sobriety } = useSobriety();
  return (
    <Link href={href} className="pdpb-card" style={{ display: "block", textDecoration: "none", color: "var(--color-texte)" }}>
      {!sobriety && <span aria-hidden="true" style={{ fontSize: 20 }}>{emoji}</span>}
      <p style={{ fontSize: 14, fontWeight: 600, margin: sobriety ? 0 : "8px 0 2px" }}>{label}</p>
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: 0 }}>{desc}</p>
    </Link>
  );
}

export default function Home() {
  const [country, setCountry] = useState("FRA");

  useEffect(() => {
    setCountry(detectDefaultCountry());
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <p style={{ fontSize: 14, color: "var(--color-texte-clair)", margin: "0 0 1rem" }}>
        Comprendre le changement climatique, pays par pays, avec des données ouvertes et
        sourcées.
      </p>

      <ActionCTA />

      <p>
        <Link href={`/pays/${country}`} style={{ fontWeight: 600 }}>Voir le résumé pour mon pays →</Link>
      </p>

      <h2 style={{ fontSize: 18, margin: "1.5rem 0 0.75rem" }}>Environnement</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {ENVIRONMENT_CARDS.map((c) => (
          <Card key={c.href} {...c} />
        ))}
      </div>

      <h2 style={{ fontSize: 18, margin: "1.5rem 0 0.75rem" }}>Démocratie (France)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {DEMOCRACY_CARDS.map((c) => (
          <Card key={c.href} {...c} />
        ))}
      </div>

      <h2 style={{ fontSize: 18, margin: "1.5rem 0 0.75rem" }}>S&apos;engager</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <Card href="/debunk" emoji="🔍" label="Débunk" desc="Idées reçues passées au crible" />
      </div>
    </div>
  );
}
