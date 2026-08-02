import { useEffect, useState } from "react";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const LOCALE_MAP = {
  fr: "fr-FR", en: "en-GB", es: "es-ES", it: "it-IT",
  ru: "ru-RU", ja: "ja-JP", zh: "zh-CN", hi: "hi-IN",
};

// Récupère une seule fois les informations de fraîcheur de chaque source de données.
export function useLastUpdated() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API_URL}/api/meta/last-updated`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);
  return data;
}

// "locale" optionnel — repli sur le français si absent, pour ne pas casser
// les appels existants qui ne le passent pas encore.
export function formatDate(isoString, locale = "fr") {
  if (!isoString) return null;
  return new Date(isoString).toLocaleString(LOCALE_MAP[locale] || "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
