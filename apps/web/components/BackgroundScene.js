import { useEffect, useRef } from "react";
import { useSobriety } from "../lib/SobrietyContext";

// Fond décoratif du site — ton illustration (scène principale, sans les
// animaux) avec les animaux fournis séparément (déjà détourés, fond
// transparent) replacés par-dessus à des positions cohérentes. Chaque
// sprite est un enfant du même conteneur que l'image de fond (même repère
// de coordonnées en %), avec un décalage de parallax additionnel qui crée
// l'effet de profondeur (les animaux, plus proches, défilent plus vite).
//
// Poids réseau : ~550 Ko au total (fond ~445 Ko + 4 sprites ~103 Ko cumulés),
// chargés une fois et mis en cache par le navigateur pour toute la visite.
//
// Entièrement désactivé en mode sobriété (aucune image chargée).
const BG_SPEED = 0.75;

const SPRITES = [
  { name: "oiseaux", src: "/images/sprite-oiseaux.webp", left: 10, top: 2, width: 30, extraSpeed: 0.15, anim: "pdpb-birds" },
  { name: "abeilles", src: "/images/sprite-abeilles.webp", left: 68, top: 38, width: 14, extraSpeed: 0.2, anim: "pdpb-bee" },
  { name: "cerf", src: "/images/sprite-cerf.webp", left: 2, top: 65, width: 16, extraSpeed: 0.1, anim: "pdpb-deer" },
  { name: "canards", src: "/images/sprite-canards.webp", left: 28, top: 76, width: 26, extraSpeed: 0.25, anim: "pdpb-ducks" },
  { name: "feu", src: "/images/sprite-feu.webp", left: 50, top: 93, width: 13, extraSpeed: 0.3, anim: "pdpb-fire" },
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
