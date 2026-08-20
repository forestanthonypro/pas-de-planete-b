import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";


export default function DesabonnerNewsletter() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState("loading"); // loading | ok | error

  useEffect(() => {
    if (!token) return;
    fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? setStatus("ok") : setStatus("error")))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
      {status === "loading" && <p>Traitement en cours...</p>}
      {status === "ok" && (
        <>
          <h1 style={{ fontSize: 22 }}>Désabonnement confirmé</h1>
          <p>Tu ne recevras plus d&apos;email de notre part.</p>
        </>
      )}
      {status === "error" && (
        <>
          <h1 style={{ fontSize: 22 }}>Lien invalide</h1>
          <p>Ce lien n&apos;est plus valable.</p>
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
