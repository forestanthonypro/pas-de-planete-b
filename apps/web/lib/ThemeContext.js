import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ theme: "light", setTheme: () => {} });

const STORAGE_KEY = "pdpb-theme";

// Mode sombre : préférence mémorisée en local, jamais envoyée au serveur.
// Par défaut, respecte la préférence du système (prefers-color-scheme),
// sinon clair — même logique que le mode sobriété pour prefers-reduced-motion.
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let initial = "light";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        initial = stored;
      } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        initial = "dark";
      }
    } catch {
      // localStorage indisponible — on reste sur la valeur par défaut.
    }
    setThemeState(initial);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Idem — pas grave si on ne peut pas mémoriser.
    }
  }, [theme, hydrated]);

  function setTheme(value) {
    setThemeState(value);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
