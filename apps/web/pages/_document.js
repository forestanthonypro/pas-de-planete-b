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
          {/* Écran de chargement personnalisé (feuille animée + nom du
              site), visible uniquement quand le site tourne en mode
              application installée (standalone) — jamais lors d'une simple
              visite dans le navigateur, pour rester cohérent avec l'esprit
              sobriété du reste du site. Entièrement en CSS pur (pas de JS
              nécessaire pour l'affichage, seulement pour le masquer une
              fois la page prête), placé ici pour s'afficher dès le tout
              premier octet de HTML, avant même l'hydratation React. */}
          <style>{`
            #pdpb-splash {
              display: none;
            }
            @media (display-mode: standalone) {
              #pdpb-splash {
                display: flex;
                position: fixed;
                inset: 0;
                z-index: 9999;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 18px;
                background: linear-gradient(160deg, #eaf3de 0%, #d9ecd0 60%, #bfe0c4 100%);
                transition: opacity 0.5s ease, visibility 0.5s ease;
              }
              #pdpb-splash.pdpb-splash-hidden {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
              }
              #pdpb-splash svg {
                animation: pdpb-splash-breathe 1.8s ease-in-out infinite;
              }
              #pdpb-splash span {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 20px;
                font-weight: 700;
                color: #1b5e20;
                letter-spacing: 0.02em;
              }
              @keyframes pdpb-splash-breathe {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.08); opacity: 0.85; }
              }
            }
          `}</style>
        </Head>
        <body>
          <div id="pdpb-splash" aria-hidden="true">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#1b5e20" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20c8 0 16-6 16-16C10 4 4 12 4 20Z" />
              <path d="M4 20c3-5 6-8 12-11" />
            </svg>
            <span>Pas de planète B</span>
          </div>
          <Main />
          <NextScript />
          {/* Masque l'écran de chargement une fois la page prête, mais
              jamais avant une durée minimale (1,5s) — sur une connexion
              rapide ou un cache déjà chaud, la page peut être prête en
              quelques centaines de ms seulement, trop vite pour lire le
              texte. window.load (pas juste DOMContentLoaded) attend aussi
              les images/polices, pour éviter un flash de contenu à moitié
              chargé derrière la transition en fondu. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  var MIN_DISPLAY_MS = 1500;
                  var start = Date.now();
                  function hideSplash() {
                    var el = document.getElementById("pdpb-splash");
                    if (el) {
                      el.classList.add("pdpb-splash-hidden");
                      setTimeout(function () { el.remove(); }, 600);
                    }
                  }
                  window.addEventListener("load", function () {
                    var elapsed = Date.now() - start;
                    var remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
                    setTimeout(hideSplash, remaining);
                  });
                })();
              `,
            }}
          />
        </body>
      </Html>
    );
  }
}
