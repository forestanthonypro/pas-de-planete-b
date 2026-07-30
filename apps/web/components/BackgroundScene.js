import { useEffect, useRef } from "react";
import { useSobriety } from "../lib/SobrietyContext";

// Fond décoratif du site — l'illustration défile derrière le contenu
// (parallax léger). Les animaux/éléments choisis (oiseaux, abeille, cerf,
// canards, feu) sont ceux DÉJÀ PRÉSENTS dans l'image elle-même — pas des
// ajouts décoratifs par-dessus. La technique : la même image est dupliquée
// une fois par élément, chaque copie découpée (clip-path) sur la zone exacte
// de l'élément concerné, et animée indépendamment (transform/filter) — le
// reste de l'image, sous ces copies, ne bouge pas. Comme on n'a pas d'outil
// de détourage d'objet ici, c'est la meilleure approximation possible sans
// recréer l'image à la main.
//
// Poids réseau : une seule image (~300 Ko, WebP compressé depuis l'original
// de 3,4 Mo) chargée une fois et réutilisée pour toutes les copies (même
// URL, mise en cache par le navigateur, pas de téléchargement multiplié).
//
// Entièrement désactivé en mode sobriété.
const IMG_SRC = "/images/scene-fond.webp";

// Zones en pourcentage de l'image (mesurées directement sur l'illustration).
const REGIONS = {
  oiseaux: { top: 1, right: 55, bottom: 93, left: 14 },
  abeille: { top: 31, right: 5, bottom: 60, left: 81 },
  cerf: { top: 49, right: 80, bottom: 40, left: 0 },
  canards: { top: 63, right: 53, bottom: 31, left: 26 },
  feu: { top: 91, right: 45, bottom: 0, left: 39 },
};

function clipPath(r) {
  return `inset(${r.top}% ${r.right}% ${r.bottom}% ${r.left}%)`;
}

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
        {/* Image de base, statique */}
        <img src={IMG_SRC} alt="" style={{ width: "100%", display: "block", opacity: 0.14 }} />

        {/* Oiseaux — la même image, recadrée sur leur zone, animée en léger
            va-et-vient pour simuler le vol. */}
        <img
          src={IMG_SRC}
          alt=""
          className="pdpb-anim-birds"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", opacity: 0.14, clipPath: clipPath(REGIONS.oiseaux), transformOrigin: "29.5% 4%" }}
        />

        {/* Abeille — petit tremblement pour simuler le vol stationnaire. */}
        <img
          src={IMG_SRC}
          alt=""
          className="pdpb-anim-bee"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", opacity: 0.14, clipPath: clipPath(REGIONS.abeille), transformOrigin: "88% 35.5%" }}
        />

        {/* Cerf — très léger balancement, idle discret. */}
        <img
          src={IMG_SRC}
          alt=""
          className="pdpb-anim-deer"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", opacity: 0.14, clipPath: clipPath(REGIONS.cerf), transformOrigin: "10% 54.5%" }}
        />

        {/* Canards + eau — tangage doux façon flottaison. */}
        <img
          src={IMG_SRC}
          alt=""
          className="pdpb-anim-ducks"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", opacity: 0.14, clipPath: clipPath(REGIONS.canards), transformOrigin: "36.5% 66%" }}
        />

        {/* Feu de camp — scintillement (luminosité + léger zoom). */}
        <img
          src={IMG_SRC}
          alt=""
          className="pdpb-anim-fire"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", opacity: 0.14, clipPath: clipPath(REGIONS.feu), transformOrigin: "47% 95.5%" }}
        />
      </div>

      <style jsx>{`
        .pdpb-anim-birds {
          animation: pdpb-birds 3.2s ease-in-out infinite;
        }
        .pdpb-anim-bee {
          animation: pdpb-bee 2s ease-in-out infinite;
        }
        .pdpb-anim-deer {
          animation: pdpb-deer 6s ease-in-out infinite;
        }
        .pdpb-anim-ducks {
          animation: pdpb-ducks 3.5s ease-in-out infinite;
        }
        .pdpb-anim-fire {
          animation: pdpb-fire 1.3s ease-in-out infinite;
        }
        @keyframes pdpb-birds {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(4px, -5px); }
        }
        @keyframes pdpb-bee {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(2px, -2px); }
          50% { transform: translate(-2px, 1px); }
          75% { transform: translate(2px, 2px); }
        }
        @keyframes pdpb-deer {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
        @keyframes pdpb-ducks {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(2.5px); }
        }
        @keyframes pdpb-fire {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.04); filter: brightness(1.25); }
        }
      `}</style>
    </div>
  );
}
