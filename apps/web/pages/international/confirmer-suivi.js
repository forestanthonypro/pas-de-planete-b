import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useT } from "../../lib/useT";


export default function ConfirmerSuiviInternational() {
  const { t } = useT();
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState("pending"); // pending | confirmed | error

  useEffect(() => {
    if (!token) return;
    fetch(`/api/parliament/member-follows/confirm?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => setStatus("confirmed"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
      {status === "pending" && <p>{t("common.loading")}</p>}
      {status === "confirmed" && (
        <>
          <p style={{ fontSize: 15, color: "#1baf7a", fontWeight: 600 }}>{t("international.follow_confirmed")}</p>
          <p style={{ fontSize: 13 }}>
            <Link href="/international">{t("international.back_to_countries")}</Link>
          </p>
        </>
      )}
      {status === "error" && <p role="alert" style={{ fontSize: 15, color: "#d63e2a" }}>{t("international.follow_confirm_error")}</p>}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
