// Liste blanche des plateformes autorisées pour embedUrl (interviews et
// ressources "paysans"). embedUrl est injecté tel quel dans un <iframe src>
// public côté frontend — sans cette validation, une session admin compromise
// pourrait faire charger n'importe quel contenu arbitraire à tous les
// visiteurs du site. La conversion automatique côté interface d'admin
// (toYoutubeEmbedUrl) est un confort, pas une protection : elle n'empêche
// pas un appel direct à l'API avec une autre valeur.
const ALLOWED_EMBED_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "open.spotify.com",
  "embed.podcasts.apple.com",
  "podcasts.apple.com",
];

export function isAllowedEmbedUrl(url) {
  if (!url) return true; // champ optionnel, absence acceptée
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_EMBED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
