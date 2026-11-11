import Head from "next/head";
import { buildPageTitle } from "../lib/pageTitle";

// Titre de page spécifique (balise <title> + aperçus og:/twitter:). Sans
// lui, toutes les pages avaient le même titre « Pas de planète B » dans
// Google et dans les onglets. Les clés (key) font que ces balises
// remplacent celles par défaut de _app.js au lieu de s'y ajouter : Next.js
// ne dédoublonne les <meta property="og:..."> que si elles ont une clé.
// DefaultHead est rendu avant la page, donc celle-ci l'emporte.
export default function PageTitle({ title }) {
  const full = buildPageTitle(title);
  if (!full) return null;
  return (
    <Head>
      <title>{full}</title>
      <meta key="og:title" property="og:title" content={full} />
      <meta key="twitter:title" name="twitter:title" content={full} />
    </Head>
  );
}
