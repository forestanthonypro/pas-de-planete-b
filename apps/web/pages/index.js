import { useEffect, useState } from "react";
import Link from "next/link";
import { detectDefaultCountry } from "../lib/detectCountry";
import ActionCTA from "../components/ActionCTA";

export default function Home() {
  const [country, setCountry] = useState("FRA");

  useEffect(() => {
    setCountry(detectDefaultCountry());
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Pas de planète B</h1>
      <ActionCTA />
      <p>
        <Link href={`/pays/${country}`}>Voir le résumé pour mon pays →</Link>
      </p>
      <ul>
        <li><Link href="/co2">Émissions de CO2 par pays →</Link></li>
        <li><Link href="/energie">Centrales électriques →</Link></li>
        <li><Link href="/especes">Espèces menacées →</Link></li>
        <li><Link href="/incendies">Feux actifs →</Link></li>
        <li><Link href="/vegetation">Perte de couverture arborée →</Link></li>
        <li><Link href="/eau">Ressources en eau →</Link></li>
        <li><Link href="/pollution">Pollution de l&apos;air →</Link></li>
      </ul>
      <h2 style={{ fontSize: 18, marginTop: "1.5rem" }}>Démocratie (France)</h2>
      <ul>
        <li><Link href="/deputes">Députés de l&apos;Assemblée nationale →</Link></li>
        <li><Link href="/groupes">Groupes politiques →</Link></li>
        <li><Link href="/scrutins">Derniers scrutins →</Link></li>
      </ul>
    </main>
  );
}
