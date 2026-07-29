import "../styles/globals.css";
import "leaflet/dist/leaflet.css";
import { SobrietyProvider } from "../lib/SobrietyContext";
import Layout from "../components/Layout";

export default function MyApp({ Component, pageProps }) {
  return (
    <SobrietyProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </SobrietyProvider>
  );
}
