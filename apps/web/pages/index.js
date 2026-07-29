import { useEffect, useState } from "react";
import Link from "next/link";
import { detectDefaultCountry } from "../lib/detectCountry";
import ActionCTA from "../components/ActionCTA";
import { useSobriety } from "../lib/SobrietyContext";
import {
  IconCloud,
  IconBolt,
  IconDroplet,
  IconTree,
  IconPaw,
  IconFlame,
  IconSmog,
  IconUsers,
  IconLandmark,
  IconScale,
  IconSearch,
} from "../components/icons";

const ENVIRONMENT_CARDS = [
  { href: "/co2", Icon: IconCloud, label: "CO2", desc: "Par pays" },
  { href: "/energie", Icon: IconBolt, label: "Énergie", desc: "Mix électrique" },
  { href: "/eau", Icon: IconDroplet, label: "Eau", desc: "Stress hydrique" },
  { href: "/vegetation", Icon: IconTree, label: "Végétation", desc: "Perte de forêt" },
  { href: "/especes", Icon: IconPaw, label: "Espèces", desc: "Menacées (UICN)" },
  { href: "/incendies", Icon: IconFlame, label: "Incendies", desc: "Détections récentes" },
  { href: "/pollution", Icon: IconSmog, label: "Pollution", desc: "PM2.5" },
];

const DEMOCRACY_CARDS = [
  { href: "/deputes", Icon: IconUsers, label: "Députés", desc: "577 en mandat" },
  { href: "/groupes", Icon: IconLandmark, label: "Groupes", desc: "Participation, cohésion" },
  { href: "/scrutins", Icon: IconScale, label: "Scrutins", desc: "8434 votes publics" },
];

function Card({ href, Icon, label, desc }) {
  const { sobriety } = useSobriety();
  return (
    <Link href={href} className="pdpb-card" style={{ display: "block", textDecoration: "none", color: "var(--color-texte)" }}>
      {!sobriety && <Icon size={22} style={{ color: "var(--color-forest)" }} />}
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
        <Card href="/debunk" Icon={IconSearch} label="Débunk" desc="Idées reçues passées au crible" />
      </div>
    </div>
  );
}
