import { useEffect, useRef } from "react";
import { useSobriety } from "../lib/SobrietyContext";

// Fond décoratif du site — ton illustration, simplement. Défile légèrement
// plus lentement que le contenu (parallax léger), assez vite pour pouvoir
// parcourir toute l'image en scrollant une page de longueur normale.
//
// Poids réseau : ~310 Ko (WebP compressé), chargé une fois et mis en cache
// par le navigateur pour toute la visite.
//
// Entièrement désactivé en mode sobriété (aucune image chargée).
export default function BackgroundScene() {
  const { sobriety } = useSobriety();
  const bgRef = useRef(null);

  useEffect(() => {
    if (sobriety) return;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (bgRef.current) bgRef.current.style.transform = `translateY(${-window.scrollY * 0.75}px)`;
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [sobriety]);

  if (sobriety) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: "#1a2438",
      }}
    >
      <div ref={bgRef} style={{ width: "100%" }}>
        <img src="/images/scene-fond.webp" alt="" style={{ width: "100%", display: "block", opacity: 0.4 }} />
      </div>
    </div>
  );
}
