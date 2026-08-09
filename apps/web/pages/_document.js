import Document, { Html, Head, Main, NextScript } from "next/document";

// Exception volontaire au style fonctionnel utilisé partout ailleurs dans le
// projet : faire remonter la locale active jusqu'à <html lang="..."> exige
// un Document en classe avec getInitialProps — c'est la seule méthode
// documentée et fiable pour ce cas précis côté Next.js (Pages Router).
// Sans ça, <html lang> restait figé sur "fr" même en naviguant en japonais
// ou en russe, ce qui trompe les lecteurs d'écran et le référencement.
export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps, locale: ctx.locale };
  }

  render() {
    return (
      <Html lang={this.props.locale || "fr"}>
        <Head>
          {/* Balise viewport placée ici (pas via next/head dans _app.js) à
              dessein : ce Document fait partie du tout premier HTML envoyé
              par le serveur, avant toute hydratation React — un viewport
              injecté seulement côté client (next/head) est absent un
              instant au premier affichage, ce qui fait rendre la page à sa
              largeur "desktop" par défaut sur mobile avant de zoomer en
              arrière pour tout faire tenir, un zoom qui reste parfois figé
              même après coup (bug repéré le 9 août 2026 : tableaux/graphiques
              débordant et toute la page miniaturisée au premier chargement
              mobile, mais pas après un rechargement). */}
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#1b5e20" />
          <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
