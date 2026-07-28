import { createContext, useContext, useEffect, useState } from "react";

const SobrietyContext = createContext({ sobriety: false, setSobriety: () => {} });

const STORAGE_KEY = "pdpb-sobriety";

// Mode sobriété : préférence mémorisée en local (respect du choix de la
// personne d'une visite à l'autre), jamais envoyée au serveur, jamais liée
// à un compte. Par défaut activé si le système d'exploitation demande
// "reduced motion" (accessibilité), sinon désactivé.
export function SobrietyProvider({ children }) {
  const [sobriety, setSobrietyState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let initial = false;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        initial = stored === "true";
      } else if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        initial = true;
      }
    } catch {
      // localStorage indisponible (navigation privée stricte) — on reste
      // sur la valeur par défaut, sans planter.
    }
    setSobrietyState(initial);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-sobriety", sobriety ? "on" : "off");
    try {
      window.localStorage.setItem(STORAGE_KEY, String(sobriety));
    } catch {
      // Idem — pas grave si on ne peut pas mémoriser.
    }
  }, [sobriety, hydrated]);

  function setSobriety(value) {
    setSobrietyState(value);
  }

  return (
    <SobrietyContext.Provider value={{ sobriety, setSobriety }}>
      {children}
    </SobrietyContext.Provider>
  );
}

export function useSobriety() {
  return useContext(SobrietyContext);
}
