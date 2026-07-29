// Convertit une URL YouTube "normale" (regardée, partagée, courte...) en URL
// d'intégration (embed) — pour que l'équipe éditoriale puisse coller
// n'importe quel lien YouTube tel quel, sans avoir à connaître le format
// d'intégration.
export function toYoutubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    let videoId = null;

    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1);
    } else if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v");
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.replace("/embed/", "");
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.replace("/shorts/", "");
      }
    }

    if (!videoId) return null;
    // Coupe tout paramètre superflu accolé à l'identifiant.
    videoId = videoId.split("&")[0].split("?")[0];
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

export function isYoutubeUrl(url) {
  if (!url) return false;
  return url.includes("youtube.com") || url.includes("youtu.be");
}
