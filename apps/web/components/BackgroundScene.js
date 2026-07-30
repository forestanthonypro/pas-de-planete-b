import { useEffect, useRef } from "react";
import { useSobriety } from "../lib/SobrietyContext";

// Fond décoratif du site — ta propre illustration, avec les animaux retirés
// de l'image de base (zone reconstituée par clonage du décor voisin, faute
// d'outil d'inpainting IA) puis replacés en sprites séparés à leur position
// d'origine exacte. Chaque sprite est positionné DANS le même repère que
// l'image (donc aligné correctement quel que soit le défilement), puis reçoit
// un décalage de parallax supplémentaire par rapport au fond — c'est cette
// différence de vitesse qui donne l'effet de profondeur (les animaux, plus
// proches, défilent plus vite que le paysage).
//
// Poids réseau : ~340 Ko au total (fond ~315 Ko + 5 sprites ~27 Ko cumulés),
// chargés une fois et mis en cache par le navigateur pour toute la visite.
//
// Entièrement désactivé en mode sobriété (aucune image chargée).
const BG_SPEED = 0.75;

// Position en % de l'image d'origine (mesurée sur l'illustration), et
// "extraSpeed" = vitesse additionnelle par rapport au fond (différence qui
// crée la profondeur — un animal au premier plan défile plus vite).
const SPRITES = [
  { name: "oiseaux", src: "/images/sprite-oiseaux.webp", left: 14.6, top: 1.3, width: 29.3, extraSpeed: 0.15, anim: "pdpb-birds" },
  { name: "abeille", src: "/images/sprite-abeille.webp", left: 83.5, top: 32.9, width: 8.8, extraSpeed: 0.2, anim: "pdpb-bee" },
  { name: "cerf", src: "/images/sprite-cerf.webp", left: 0, top: 49.5, width: 19.5, extraSpeed: 0.08, anim: "pdpb-deer" },
  { name: "canards", src: "/images/sprite-canards.webp", left: 26.4, top: 63.2, width: 20.5, extraSpeed: 0.25, anim: "pdpb-ducks" },
  { name: "feu", src: "/images/sprite-feu.webp", left: 40.5, top: 92.4, width: 12.7, extraSpeed: 0.3, anim: "pdpb-fire" },
];

export default function BackgroundScene() {
  const { sobriety } = useSobriety();
  const bgRef = useRef(null);
  const spriteRefs = useRef([]);

  useEffect(() => {
    if (sobriety) return;

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (bgRef.current) bgRef.current.style.transform = `translateY(${-y * BG_SPEED}px)`;
        spriteRefs.current.forEach((el, i) => {
          if (!el) return;
          // Décalage additionnel seulement — la position de base suit déjà
          // le fond puisque le sprite est un enfant du même conteneur.
          el.style.transform = `translateY(${-y * SPRITES[i].extraSpeed}px)`;
        });
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
      {/* Conteneur unique : l'image de fond ET les sprites des animaux
          partagent ce même repère de coordonnées (en %), donc restent bien
          alignés avec l'image quel que soit le défilement. Ce conteneur
          porte la vitesse de fond ; chaque sprite reçoit en plus son propre
          décalage (différence de vitesse) pour l'effet de profondeur. */}
      <div ref={bgRef} style={{ position: "relative", width: "100%" }}>
        <img src="/images/scene-fond.webp" alt="" style={{ width: "100%", display: "block", opacity: 0.4 }} />

        {SPRITES.map((s, i) => (
          <img
            key={s.name}
            ref={(el) => (spriteRefs.current[i] = el)}
            src={s.src}
            alt=""
            className={s.anim}
            style={{
              position: "absolute",
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.width}%`,
              opacity: 0.4,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        .pdpb-birds {
          animation: pdpb-fly 3.4s ease-in-out infinite;
        }
        .pdpb-bee {
          animation: pdpb-buzz 1.8s ease-in-out infinite;
        }
        .pdpb-deer {
          animation: pdpb-sway 6s ease-in-out infinite;
        }
        .pdpb-ducks {
          animation: pdpb-bob 3s ease-in-out infinite;
        }
        .pdpb-fire {
          animation: pdpb-flicker 1.1s ease-in-out infinite;
          transform-origin: center bottom;
        }
        @keyframes pdpb-fly {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(5px, -5px); }
        }
        @keyframes pdpb-buzz {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(3px, -2px); }
          50% { transform: translate(-2px, 2px); }
          75% { transform: translate(2px, 2px); }
        }
        @keyframes pdpb-sway {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes pdpb-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(2.5px); }
        }
        @keyframes pdpb-flicker {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.05); filter: brightness(1.3); }
        }
      `}</style>
    </div>
  );
}
