import Head from "next/head";
import { useT } from "../../lib/useT";
import ShareButtons from "../../components/ShareButtons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WEB_URL = "https://pasdeplaneteb.com";

export default function KitCommunicationCountryPage({ countryCode, countryName, locale }) {
  const { t } = useT();

  const htmlEndpoint = `/api/kit-communication/html/${countryCode}?lang=${locale}`;
  const pdfEndpoint = `/api/kit-communication/pdf/${countryCode}?lang=${locale}`;
  const ogImageUrl = `/api/kit-communication/og-image/${countryCode}?lang=${locale}`;
  const canonicalUrl = `${WEB_URL}${locale === "fr" ? "" : "/" + locale}/kit-communication/${countryCode.toLowerCase()}`;

  const pageTitle = `${t("kit.title")} — ${countryName} | Pas de planète B`;
  const pageDescription = t("kit.subtitle");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>

      <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
        <a
          href={pdfEndpoint}
          style={{
            display: "inline-block",
            background: "var(--color-forest)",
            color: "white",
            padding: "10px 22px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {t("kit.download_pdf_button")}
        </a>
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: 8 }}>{t("kit.always_fresh_hint")}</p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
        <ShareButtons title={pageTitle} url={canonicalUrl} />
      </div>

      {/* Contenu du kit dans une iframe isolée — évite tout risque de
          collision entre les classes CSS du gabarit PDF (très génériques :
          .content, .tag, .detail...) et le reste du site. Chargée
          directement par le navigateur, toujours la version la plus
          fraîche des données à chaque visite. Hauteur généreuse : le
          contenu est désormais responsive (voir kitTemplate.js) et
          s'étire davantage sur mobile, où les grilles s'empilent. */}
      <iframe
        src={htmlEndpoint}
        title={pageTitle}
        style={{ width: "100%", height: "3200px", border: "1px solid var(--color-bordure)", borderRadius: 8 }}
      />
    </div>
  );
}

export async function getServerSideProps({ params, locale }) {
  const code = params.code.toUpperCase();
  try {
    const res = await fetch(`${API_URL}/api/kit-communication/country/${code}?lang=${locale}`);
    if (!res.ok) return { notFound: true };
    const data = await res.json();
    return { props: { countryCode: code, countryName: data.countryName, locale } };
  } catch (err) {
    return { notFound: true };
  }
}
