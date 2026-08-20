import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Hook générique pour les appels GET à l'API : gère loading/error/data et
// annule la requête si le composant est démonté avant la résolution (évite
// les "Can't perform a React state update on an unmounted component").
//
// path: chemin relatif (ex: "/api/co2") ou null pour ne rien charger.
// transform: fonction optionnelle appliquée aux données reçues avant setData.
// headers: en-têtes additionnels.
// credentials: "include" pour les pages admin (envoie le cookie de session
// HttpOnly avec la requête — voir components/AdminAuthGate.js).
// deps: dépendances supplémentaires qui doivent redéclencher le fetch.
export function useApiFetch(path, { transform, errorMessage = "Erreur de chargement", skip = false, deps = [], headers, credentials } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path) && !skip);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path || skip) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const options = {};
    if (headers) options.headers = headers;
    if (credentials) options.credentials = credentials;
    fetch(`${API_URL}${path}`, Object.keys(options).length > 0 ? options : undefined)
      .then((res) => {
        if (!res.ok) throw new Error(errorMessage);
        return res.json();
      })
      .then((rows) => {
        if (cancelled) return;
        setData(transform ? transform(rows) : rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, skip, ...deps]);

  return { data, loading, error, setData };
}
