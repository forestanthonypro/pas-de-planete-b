import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";


export default function ConfirmerNewsletter() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState("loading"); // loading | ok | error

  useEffect(() => {
    if (!token) return;
    fetch(`/api/newsletter/confirm?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? setStatus("ok") : setStatus("error")))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
      {status === "loading" && <p>Vérification en cours...</p>}
      {status === "ok" && (
        <>
          <h1 style={{ fontSize: 22 }}>Inscription confirmée</h1>
          <p>Tu recevras désormais des actions concrètes par email.</p>
        </>
      )}
      {status === "error" && (
        <>
          <h1 style={{ fontSize: 22 }}>Lien invalide</h1>
          <p>Ce lien de confirmation n&apos;est plus valable.</p>
        </>
      )}
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/">Retour à l&apos;accueil</Link>
      </p>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
