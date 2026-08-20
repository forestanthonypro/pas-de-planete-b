import { useEffect, useState } from "react";


// Récupère une seule fois les repères mondiaux (une valeur par métrique,
// pas une série complète) pour comparer le pays sélectionné au reste du monde.
export function useWorldBenchmarks() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/world-benchmarks`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return data;
}
