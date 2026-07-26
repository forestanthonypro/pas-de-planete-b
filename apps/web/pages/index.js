import Link from "next/link";

export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Pas de planète B</h1>
      <p>
        <Link href="/co2">Voir les émissions de CO2 par pays →</Link>
      </p>
    </main>
  );
}
