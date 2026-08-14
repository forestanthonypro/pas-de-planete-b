import { useEffect } from "react";
import Head from "next/head";
import Script from "next/script";
import "../styles/globals.css";
import { SobrietyProvider } from "../lib/SobrietyContext";
import { ThemeProvider } from "../lib/ThemeContext";
import { LocaleContext } from "../lib/LocaleContext";
import { useT } from "../lib/useT";
import Layout from "../components/Layout";

// <title> et meta description par défaut, valables sur tout le site — sans
// ça, aucune page n'a ni titre ni description (repéré par un audit SEO
// Lighthouse/PageSpeed externe, score SEO impacté). Réutilise home.intro
// (déjà traduit dans les 8 langues) plutôt que d'ajouter du texte neuf.
// Amélioration possible plus tard : un titre spécifique par page plutôt
// qu'un seul titre générique partout.
function DefaultHead({ router }) {
  const { t } = useT();
  // Les pages filtrées par section (/?section=democratie, etc.) sont vues
  // par Google comme des doublons de l'accueil sans indication claire — la
  // canonique règle ça en pointant systématiquement vers l'URL sans
  // paramètres de requête (repéré via Search Console le 9 août 2026).
  const canonicalPath = router?.asPath?.split("?")[0]?.split("#")[0] || "/";
  const canonicalUrl = `https://pasdeplaneteb.com${canonicalPath}`;
  return (
    <Head>
      <title>Pas de planète B</title>
      <meta name="description" content={t("home.intro")} />
      <link rel="canonical" href={canonicalUrl} />
    </Head>
  );
}

// Matomo (analytics auto-hébergé, voir stats.pasdeplaneteb.com) — chargé
// uniquement en production, pour ne jamais polluer les statistiques avec
// du trafic de développement/test local. Next.js navigue côté client (SPA)
// entre les pages : le simple script fourni par Matomo ne suit que le tout
// premier chargement. Un suivi manuel sur chaque changement de route est
// donc nécessaire (voir useEffect sur router.events plus bas), sans quoi
// la quasi-totalité des pages vues ne serait jamais comptabilisée.
function MatomoTracking({ router }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    function trackPageView(url) {
      if (typeof window === "undefined" || !window._paq) return;
      window._paq.push(["setCustomUrl", url]);
      window._paq.push(["setDocumentTitle", document.title]);
      window._paq.push(["trackPageView"]);
    }
    router.events.on("routeChangeComplete", trackPageView);
    return () => router.events.off("routeChangeComplete", trackPageView);
  }, [router.events]);

  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Script id="matomo-tracking" strategy="afterInteractive">
      {`
        var _paq = window._paq = window._paq || [];
        _paq.push(['disableCookies']);
        _paq.push(['trackPageView']);
        _paq.push(['enableLinkTracking']);
        (function() {
          var u="https://stats.pasdeplaneteb.com/";
          _paq.push(['setTrackerUrl', u+'matomo.php']);
          _paq.push(['setSiteId', '1']);
          var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
          g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
        })();
      `}
    </Script>
  );
}

export default function MyApp({ Component, pageProps, router }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Échec silencieux : l'app reste utilisable sans le service worker,
        // juste sans le bénéfice de la mise en cache.
      });
    }
  }, []);

  const page = <Component {...pageProps} />;

  // Certaines pages (404/500) sont générées statiquement par Next.js sans
  // contexte routeur complet — Layout (via LanguageSwitcher, qui appelle
  // useRouter()) en a besoin. Ces pages s'excluent explicitement de Layout
  // via Component.noLayout = true plutôt que de faire échouer le Hook
  // silencieusement (voir KNOWN_ISSUES_build.md pour l'historique complet
  // du bug de build que cette confusion a causé).
  //
  // La prop "router" ci-dessus (pas le Hook useRouter()) alimente
  // LocaleContext, consommé par useT() sur toutes les pages — cette prop
  // est toujours disponible, contrairement au Hook qui peut lever une
  // exception dans les mêmes cas particuliers que ci-dessus.
  const localeValue = {
    locale: router?.locale || "fr",
    locales: router?.locales || ["fr"],
    defaultLocale: router?.defaultLocale || "fr",
  };

  if (Component.noLayout) {
    return (
      <LocaleContext.Provider value={localeValue}>
        <DefaultHead router={router} />
        <MatomoTracking router={router} />
        {page}
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={localeValue}>
      <DefaultHead router={router} />
      <MatomoTracking router={router} />
      <ThemeProvider>
        <SobrietyProvider>
          <Layout>{page}</Layout>
        </SobrietyProvider>
      </ThemeProvider>
    </LocaleContext.Provider>
  );
}
