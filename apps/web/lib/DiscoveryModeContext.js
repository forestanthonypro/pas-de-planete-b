import { createContext, useContext, useEffect, useState } from "react";

const DiscoveryModeContext = createContext({ isDiscovery: false, setIsDiscovery: () => {}, hydrated: false });

const STORAGE_KEY = "pdpb-discovery-mode";

// Mode découverte / mode expert : préférence mémorisée en local, comme le
// mode sobriété (voir SobrietyContext.js, même patron de masquage jusqu'à
// hydratation confirmée — évite exactement la même famille d'erreurs
// d'hydratation qu'on a dû corriger pour la sobriété).
//
// Par défaut, découverte = true pour un premier visiteur (aucune préférence
// stockée) — le mode découverte est la porte d'entrée par défaut du site,
// le mode expert est un choix explicite.
export function DiscoveryModeProvider({ children }) {
  const [isDiscovery, setIsDiscoveryState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let initial = true; // découverte par défaut pour un premier visiteur
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        initial = stored === "true";
      }
    } catch {
      // localStorage indisponible (navigation privée stricte) — on reste
      // sur la valeur par défaut, sans planter.
    }
    setIsDiscoveryState(initial);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(isDiscovery));
    } catch {
      // Idem — pas grave si on ne peut pas mémoriser.
    }
  }, [isDiscovery, hydrated]);

  function setIsDiscovery(value) {
    setIsDiscoveryState(value);
  }

  return (
    <DiscoveryModeContext.Provider value={{ isDiscovery, setIsDiscovery, hydrated }}>
      {children}
    </DiscoveryModeContext.Provider>
  );
}

// Masque la vraie valeur tant que l'hydratation n'est pas terminée — même
// principe que useSobriety(), voir SobrietyContext.js pour l'explication
// complète du pourquoi.
export function useDiscoveryMode() {
  const { isDiscovery, setIsDiscovery, hydrated } = useContext(DiscoveryModeContext);
  return { isDiscovery: hydrated ? isDiscovery : false, setIsDiscovery, hydrated };
}
