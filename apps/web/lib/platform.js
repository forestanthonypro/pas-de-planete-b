import { useEffect, useState } from "react";

// Détecte si le code tourne dans l'app mobile Capacitor plutôt que dans un
// navigateur web classique. Capacitor injecte automatiquement `window.Capacitor`
// avec `isNativePlatform()` quand le site est chargé via l'app — pas besoin
// de dépendance supplémentaire pour cette vérification basique.
export function isNativeApp() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform()
  );
}

// Version hook : démarre à `false` (identique au rendu serveur, évite tout
// souci d'hydratation) puis se met à jour une fois monté côté client, comme
// pour ThemeContext/SobrietyContext ailleurs dans le projet.
export function useIsNativeApp() {
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    setIsNative(isNativeApp());
  }, []);
  return isNative;
}

// Détecte un écran étroit (navigateur mobile classique, PAS l'app native —
// voir useIsNativeApp ci-dessus pour ça). Basé sur matchMedia plutôt qu'un
// simple innerWidth pour se mettre à jour automatiquement en cas de
// rotation d'écran ou de redimensionnement de fenêtre.
const MOBILE_BREAKPOINT = "(max-width: 640px)";

export function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    setIsMobile(mql.matches);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}
