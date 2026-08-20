import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "../lib/useT";
import { supportsWebPush, readPushManagement } from "../lib/pushNotifications";
import { IconBell } from "./icons";

const DISMISS_KEY = "pdpb_notif_banner_dismissed_v1";

// Bannière discrète invitant à activer les notifications, affichée sur le
// site (pas seulement l'icône 🔔 dans la nav, peu visible pour un premier
// visiteur). Ne déclenche JAMAIS Notification.requestPermission()
// directement : ça doit toujours passer par un vrai clic sur /notifications,
// où l'utilisateur choisit ses préférences (pays/sujets) avant tout —
// demander la permission "à l'aveugle" depuis une bannière générique serait
// à la fois une mauvaise pratique (la plupart des navigateurs bloquent ou
// pénalisent les demandes non liées à un contexte clair) et incohérent avec
// le système de préférences déjà en place.
//
// Affichée seulement si : le navigateur supporte le Push, la permission n'a
// jamais été demandée (ni accordée ni refusée), l'utilisateur n'est pas
// déjà abonné, et il n'a pas déjà fermé la bannière (mémorisé en
// localStorage, indéfiniment — pas de relance après un premier rejet).
//
// Etats par défaut à `false`/`null` côté serveur ET au premier rendu
// client, mis à jour uniquement en useEffect après montage — même
// précaution d'hydratation que pages/notifications.js (voir
// lib/pushNotifications.js et les commentaires associés).
export default function NotificationsPromptBanner() {
  const { t } = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!supportsWebPush()) return;
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;
    if (readPushManagement()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        background: "var(--color-carte)",
        border: "1px solid var(--color-bordure)",
        borderRadius: 12,
        padding: "0.75rem 1rem",
        margin: "0 auto 1rem",
        maxWidth: 900,
      }}
    >
      <IconBell size={18} style={{ flexShrink: 0, color: "var(--color-forest)" }} />
      <span style={{ flex: 1, fontSize: 14 }}>{t("push_follow.banner_text")}</span>
      <Link
        href="/notifications"
        prefetch={false}
        style={{
          background: "var(--color-forest)",
          color: "white",
          padding: "6px 14px",
          borderRadius: 20,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 13,
          whiteSpace: "nowrap",
        }}
      >
        {t("push_follow.banner_cta")}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("push_follow.banner_dismiss")}
        title={t("push_follow.banner_dismiss")}
        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "var(--color-texte-clair)", padding: "0 4px" }}
      >
        ×
      </button>
    </div>
  );
}
