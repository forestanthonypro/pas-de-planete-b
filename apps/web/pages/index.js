import { useEffect, useState } from "react";
import Link from "next/link";
import { detectDefaultCountry } from "../lib/detectCountry";

export default function Home() {
  const [country, setCountry] = useState("FRA");

  useEffect(() => {
    setCountry(detectDefaultCountry());
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Pas de planète B</h1>
      <p>
        <Link href={`/pays/${country}`}>Voir le résumé pour mon pays →</Link>
      </p>
      <ul>
        <li><Link href="/co2">Émissions de CO2 par pays →</Link></li>
        <li><Link href="/energie">Centrales électriques →</Link></li>
        <li><Link href="/especes">Espèces menacées →</Link></li>
        <li><Link href="/incendies">Feux actifs →</Link></li>
      </ul>
    </main>
  );
}
