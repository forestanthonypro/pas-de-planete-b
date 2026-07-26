import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

export function formatDate(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
