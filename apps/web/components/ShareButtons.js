import { useState } from "react";
import { useT } from "../lib/useT";

// Boutons de partage — que des liens standards vers les services de partage
// (aucune clé API, aucune dépendance JS supplémentaire, cohérent avec
// l'écoconception du site). "title" doit décrire la page/le graphique
// affiché, pour que le message partagé ait du sens.
export default function ShareButtons({ title, url }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title || "Pas de planète B");

  function handleCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  const links = [
    {
      label: "X / Twitter",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      label: "WhatsApp",
      href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: 13 }}>
      <span style={{ color: "#666" }}>{t("common.share_label")}</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "3px 8px", border: "1px solid #ccc", borderRadius: 4, color: "#333", textDecoration: "none" }}
        >
          {l.label}
        </a>
      ))}
      <button
        type="button"
        onClick={handleCopy}
        style={{ padding: "3px 8px", border: "1px solid #ccc", borderRadius: 4, background: "white", cursor: "pointer", fontSize: 13 }}
      >
        {copied ? t("common.share_copied") : t("common.share_copy")}
      </button>
    </div>
  );
}
