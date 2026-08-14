import { createContext, useContext, useEffect, useState } from "react";

const SobrietyContext = createContext({ sobriety: false, setSobriety: () => {}, hydrated: false });

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
    <SobrietyContext.Provider value={{ sobriety, setSobriety, hydrated }}>
      {children}
    </SobrietyContext.Provider>
  );
}

// Masque la vraie valeur de "sobriety" tant que l'hydratation n'est pas
// terminée (hydrated === false) : tous les composants qui consomment ce
// Hook reçoivent systématiquement `false` pendant le rendu serveur ET le
// tout premier rendu client (avant que les effets ne s'exécutent) — les
// deux sont donc garantis identiques, quelle que soit la vraie préférence
// mémorisée en local. Ce n'est qu'une fois l'hydratation confirmée terminée
// que la vraie valeur (issue de localStorage) est exposée. Corrige à la
// source les erreurs d'hydratation "Recoverable Error" qui pouvaient
// survenir sur n'importe quelle page bifurquant significativement son rendu
// selon le mode sobriété (ex: la carte d'accueil, PageHeader).
export function useSobriety() {
  const { sobriety, setSobriety, hydrated } = useContext(SobrietyContext);
  return { sobriety: hydrated ? sobriety : false, setSobriety, hydrated };
}