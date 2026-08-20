import { useEffect } from "react";
import Head from "next/head";
import Script from "next/script";
import "../styles/globals.css";
import { SobrietyProvider } from "../lib/SobrietyContext";
import { DiscoveryModeProvider } from "../lib/DiscoveryModeContext";
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
//
// hreflang : le sitemap.xml (voir sitemap.xml.js) ne déclare le hreflang
// que pour les pages "principales" (une trentaine) — pas les milliers de
// pages dynamiques (chaque scrutin, chaque député) qui seraient bien trop
// nombreuses pour un sitemap. Sans hreflang du tout, Google ne peut pas
// distinguer ces pages profondes de simples doublons entre langues, et les
// signale comme telles en Search Console (repéré le 16 août 2026 : 184
// pages "en double sans URL canonique", ~150 échecs de validation
// d'indexation, presque toutes des /scrutins/... et /deputes/... traduits).
// Générer le hreflang ici, de façon centralisée pour TOUTE page du site,
// couvre ces pages profondes sans avoir à toucher chaque fichier un par un.
function DefaultHead({ router }) {
  const { t } = useT();
  // Les pages filtrées par section (/?section=democratie, etc.) sont vues
  // par Google comme des doublons de l'accueil sans indication claire — la
  // canonique règle ça en pointant systématiquement vers l'URL sans
  // paramètres de requête (repéré via Search Console le 9 août 2026).
  const canonicalPath = router?.asPath?.split("?")[0]?.split("#")[0] || "/";

  const locales = router?.locales?.length ? router.locales : ["fr"];
  const defaultLocale = router?.defaultLocale || "fr";
  const currentLocale = router?.locale || defaultLocale;
  const currentPrefix = currentLocale !== defaultLocale ? `/${currentLocale}` : "";
  // Chemin "nu" — sans le préfixe de langue courant — pour pouvoir
  // réappliquer le bon préfixe (ou aucun, pour le français) à chaque
  // langue ci-dessous.
  let barePath = currentPrefix && canonicalPath.startsWith(currentPrefix) ? canonicalPath.slice(currentPrefix.length) : canonicalPath;
  if (barePath === "") barePath = "/";

  function urlForLocale(locale) {
    const p = barePath === "/" ? "" : barePath;
    return locale === defaultLocale ? `https://pasdeplaneteb.com${p || "/"}` : `https://pasdeplaneteb.com/${locale}${p}`;
  }

  // Next.js retire le préfixe de langue de router.asPath : sur
  // /en/decouverte, canonicalPath vaut donc /decouverte. Construire la
  // canonique directement avec canonicalPath faisait pointer toutes les
  // traductions vers la page française, ce qui incitait Google à les
  // considérer comme des doublons. Chaque langue doit au contraire avoir
  // une canonique autoréférente, cohérente avec ses liens hreflang.
  const canonicalUrl = urlForLocale(currentLocale);

  return (
    <Head>
      <title>Pas de planète B</title>
      <meta name="description" content={t("home.intro")} />
      <link rel="canonical" href={canonicalUrl} />
      {/* Image de partage par défaut — sans elle, un lien du site collé
          dans SMS/WhatsApp/Signal/réseaux sociaux n'affiche aucun aperçu
          riche (juste le lien nu). Image statique (pas de génération à la
          demande, contrairement au kit de communication qui a besoin de
          données par pays) : contenu générique, ne change jamais d'un
          partage à l'autre — voir public/og-image.png. Une page qui a
          besoin d'un aperçu plus spécifique peut définir ses propres
          balises og:* dans son propre <Head>, qui prennent le dessus. */}
      <meta property="og:title" content="Pas de planète B" />
      <meta property="og:description" content={t("home.intro")} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="https://pasdeplaneteb.com/og-image.png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Pas de planète B" />
      <meta name="twitter:description" content={t("home.intro")} />
      <meta name="twitter:image" content="https://pasdeplaneteb.com/og-image.png" />
      {locales.map((loc) => (
        <link key={loc} rel="alternate" hrefLang={loc} href={urlForLocale(loc)} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={urlForLocale(defaultLocale)} />
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
          <DiscoveryModeProvider>
            <Layout>{page}</Layout>
          </DiscoveryModeProvider>
        </SobrietyProvider>
      </ThemeProvider>
    </LocaleContext.Provider>
  );
}
