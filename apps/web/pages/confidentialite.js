import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import PageHeader from "../components/PageHeader";
import { IconScroll } from "../components/icons";
import { useT } from "../lib/useT";


export default function Confidentialite() {
  const { t } = useT();
  const router = useRouter();
  const [html, setHtml] = useState(null);

  useEffect(() => {
    const locale = router.locale || "fr";
    const key = locale === "fr" ? "confidentialite_content" : `confidentialite_content_${locale}`;
    fetch(`/api/settings/legal-content/${key}`)
      .then((res) => (res.ok ? res.json() : { content: "" }))
      .then((data) => setHtml(data.content))
      .catch(() => setHtml(""));
  }, [router.locale]);

  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <PageHeader Icon={IconScroll} tint="green" title={t("common.footer_privacy")} />

      {html === null && <p>{t("common.loading")}</p>}
      {html !== null && (
        <>
          <div className="pdpb-legal-content" dangerouslySetInnerHTML={{ __html: html }} />
          <style jsx global>{`
            .pdpb-legal-content {
              font-size: 14px;
              line-height: 1.7;
              color: var(--color-texte);
            }
            .pdpb-legal-content section {
              margin-bottom: 1.75rem;
            }
            .pdpb-legal-content h2 {
              font-size: 18px;
              margin-bottom: 0.5rem;
            }
            .pdpb-legal-content h3 {
              font-size: 16px;
              margin: 1rem 0 0.5rem;
              color: var(--color-texte);
            }
            .pdpb-legal-content p {
              font-size: 14px;
              line-height: 1.7;
              margin: 0 0 0.75rem;
              color: var(--color-texte);
            }
            .pdpb-legal-content ul,
            .pdpb-legal-content ol {
              font-size: 14px;
              line-height: 1.7;
              margin: 0 0 0.75rem;
              padding-left: 1.5rem;
              color: var(--color-texte);
            }
            .pdpb-legal-content li {
              margin-bottom: 0.35rem;
            }
            .pdpb-legal-content a {
              color: var(--color-forest);
            }
          `}</style>
        </>
      )}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
        <Link href="/mentions-legales">{t("common.footer_legal")}</Link>
      </p>
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "0.5rem" }}>
        <Link href="/">{t("common.back_to_home")}</Link>
      </p>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
