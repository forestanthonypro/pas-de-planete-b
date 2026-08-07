import { useEffect } from "react";
import "../styles/globals.css";
import "leaflet/dist/leaflet.css";
import { SobrietyProvider } from "../lib/SobrietyContext";
import { ThemeProvider } from "../lib/ThemeContext";
import { LocaleContext } from "../lib/LocaleContext";
import Layout from "../components/Layout";

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
    return <LocaleContext.Provider value={localeValue}>{page}</LocaleContext.Provider>;
  }

  return (
    <LocaleContext.Provider value={localeValue}>
      <ThemeProvider>
        <SobrietyProvider>
          <Layout>{page}</Layout>
        </SobrietyProvider>
      </ThemeProvider>
    </LocaleContext.Provider>
  );
}
