import { useEffect } from "react";
import "../styles/globals.css";
import "leaflet/dist/leaflet.css";
import { SobrietyProvider } from "../lib/SobrietyContext";
import { ThemeProvider } from "../lib/ThemeContext";
import Layout from "../components/Layout";

export default function MyApp({ Component, pageProps }) {
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
  if (Component.noLayout) {
    return page;
  }

  return (
    <ThemeProvider>
      <SobrietyProvider>
        <Layout>{page}</Layout>
      </SobrietyProvider>
    </ThemeProvider>
  );
}
