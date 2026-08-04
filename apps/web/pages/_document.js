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
