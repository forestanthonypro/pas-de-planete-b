import Link from "next/link";

export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Pas de planète B</h1>
      <ul>
        <li><Link href="/co2">Émissions de CO2 par pays →</Link></li>
        <li><Link href="/energie">Centrales électriques →</Link></li>
        <li><Link href="/especes">Espèces menacées →</Link></li>
      </ul>
    </main>
  );
}
