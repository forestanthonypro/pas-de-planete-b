import { useEffect, useRef } from "react";
import { useSobriety } from "../lib/SobrietyContext";

// Fond décoratif du site — l'illustration reste fixe pendant que le contenu
// défile par-dessus (parallax léger : l'image bouge un peu moins vite que
// la page). Quelques éléments choisis (oiseaux, abeille, cerf, canards/eau,
// feu) sont animés séparément en surimpression, positionnés approximativement
// à l'endroit où ils apparaissent dans l'illustration.
//
// Poids réseau : ~300 Ko (WebP compressé depuis l'image d'origine de 3,4 Mo)
// — plus lourd que le reste du site qui n'utilise que du CSS, mais un
// compromis raisonnable pour une image chargée une seule fois et mise en
// cache par le navigateur pour toute la visite.
//
// Entièrement désactivé en mode sobriété (aucune image chargée, aucun DOM
// ajouté, aucun listener de scroll).
export default function BackgroundScene() {
  const { sobriety } = useSobriety();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (sobriety) return;
    const el = wrapRef.current;
    if (!el) return;

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        el.style.transform = `translateY(${-window.scrollY * 0.85}px)`;
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
      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
        <img
          src="/images/scene-fond.webp"
          alt=""
          style={{ width: "100%", display: "block", opacity: 0.14 }}
        />

        {/* Oiseaux — haut de l'image */}
        <div style={{ position: "absolute", top: "4%", left: "18%", fontSize: 22, opacity: 0.45, animation: "pdpb-bird-fly 4s ease-in-out infinite" }}>🕊️</div>
        <div style={{ position: "absolute", top: "5.5%", left: "24%", fontSize: 16, opacity: 0.45, animation: "pdpb-bird-fly 4s ease-in-out infinite 0.6s" }}>🕊️</div>
        <div style={{ position: "absolute", top: "3%", left: "30%", fontSize: 14, opacity: 0.45, animation: "pdpb-bird-fly 4s ease-in-out infinite 1.2s" }}>🕊️</div>

        {/* Abeille — près de la fleur, à droite */}
        <div style={{ position: "absolute", top: "34%", left: "89%", fontSize: 18, opacity: 0.5, animation: "pdpb-bee-buzz 2.5s ease-in-out infinite" }}>🐝</div>

        {/* Cerf — à gauche, dans la clairière */}
        <div style={{ position: "absolute", top: "56%", left: "6%", fontSize: 26, opacity: 0.4, animation: "pdpb-idle-sway 5s ease-in-out infinite" }}>🦌</div>

        {/* Canards + reflet de l'eau — sur le ruisseau */}
        <div style={{ position: "absolute", top: "65%", left: "34%", fontSize: 18, opacity: 0.45, animation: "pdpb-duck-bob 3s ease-in-out infinite" }}>🦆</div>
        <div style={{ position: "absolute", top: "66%", left: "40%", fontSize: 16, opacity: 0.45, animation: "pdpb-duck-bob 3s ease-in-out infinite 0.5s" }}>🦆</div>
        <div
          style={{
            position: "absolute",
            top: "63%",
            left: "20%",
            width: "35%",
            height: "6%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
            animation: "pdpb-water-shimmer 3.5s ease-in-out infinite",
          }}
        />

        {/* Feu de camp — en bas de la scène */}
        <div
          style={{
            position: "absolute",
            top: "93.5%",
            left: "46%",
            width: 26,
            height: 34,
            background: "radial-gradient(circle, rgba(255,180,60,0.9) 0%, rgba(255,120,20,0.5) 55%, rgba(255,80,0,0) 80%)",
            borderRadius: "50% 50% 40% 40%",
            animation: "pdpb-fire-flicker 1.4s ease-in-out infinite",
          }}
        />
      </div>

      <style jsx>{`
        @keyframes pdpb-bird-fly {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(6px, -4px); }
        }
        @keyframes pdpb-bee-buzz {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(3px, -3px); }
          50% { transform: translate(-2px, 2px); }
          75% { transform: translate(3px, 3px); }
        }
        @keyframes pdpb-idle-sway {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(-1deg); }
        }
        @keyframes pdpb-duck-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
        @keyframes pdpb-water-shimmer {
          0% { opacity: 0.2; transform: translateX(-10%); }
          50% { opacity: 0.6; transform: translateX(10%); }
          100% { opacity: 0.2; transform: translateX(-10%); }
        }
        @keyframes pdpb-fire-flicker {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}
