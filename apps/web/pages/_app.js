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

  return (
    <ThemeProvider>
      <SobrietyProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </SobrietyProvider>
    </ThemeProvider>
  );
}
