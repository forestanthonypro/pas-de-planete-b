import { useEffect, useRef } from "react";
import { useSobriety } from "../lib/SobrietyContext";

// Fond décoratif du site — scène dessinée en couches séparées (SVG), chaque
// couche défilant à sa propre vitesse au scroll (parallax réel : ciel très
// lent, collines moyennes, premier plan proche de la vitesse du contenu).
// C'est fondamentalement différent d'une image plate recadrée : ici, chaque
// élément est un vrai calque indépendant, donc les vitesses peuvent
// vraiment diverger entre eux (effet de profondeur).
//
// Les animaux demandés (oiseaux, abeille, cerf, canards + eau, feu) sont au
// premier plan, chacun avec sa propre micro-animation (vol, tremblement,
// tangage, scintillement) en plus du parallax.
//
// 100% CSS/SVG — aucune image téléchargée, cohérent avec l'écoconception du
// reste du site. Entièrement désactivé en mode sobriété.
const LAYERS_HEIGHT = 5200;

export default function BackgroundScene() {
  const { sobriety } = useSobriety();
  const containerRef = useRef(null);

  useEffect(() => {
    if (sobriety) return;
    const layers = containerRef.current?.querySelectorAll("[data-speed]");
    if (!layers || layers.length === 0) return;

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        layers.forEach((layer) => {
          const speed = parseFloat(layer.dataset.speed);
          layer.style.transform = `translateY(${-y * speed}px)`;
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
      ref={containerRef}
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
        background: "linear-gradient(180deg, #bfe0f5 0%, #d9ecd0 45%, #8fc793 100%)",
      }}
    >
      {/* Couche 1 — ciel : soleil, nuages, montagnes lointaines. Très lente. */}
      <svg
        data-speed="0.04"
        style={{ position: "absolute", top: 0, left: 0, width: "100%" }}
        viewBox={`0 0 1200 ${LAYERS_HEIGHT}`}
        width="100%"
        height={LAYERS_HEIGHT}
        preserveAspectRatio="xMidYMin slice"
      >
        <circle cx="1040" cy="110" r="55" fill="#fff2c2" opacity="0.7" />
        <g className="pdpb-cloud" fill="white" opacity="0.6">
          <ellipse cx="200" cy="90" rx="55" ry="22" />
          <ellipse cx="245" cy="80" rx="36" ry="18" />
        </g>
        <g className="pdpb-cloud" fill="white" opacity="0.6" style={{ animationDelay: "-7s" }}>
          <ellipse cx="700" cy="60" rx="46" ry="18" />
          <ellipse cx="735" cy="55" rx="28" ry="14" />
        </g>
        <path d="M0 320 L150 200 L280 300 L420 180 L600 320 L750 220 L900 310 L1050 210 L1200 300 L1200 420 L0 420 Z" fill="#9bb8c9" opacity="0.5" />
      </svg>

      {/* Couche 2 — collines et éoliennes. Vitesse moyenne-lente. */}
      <svg
        data-speed="0.12"
        style={{ position: "absolute", top: 0, left: 0, width: "100%" }}
        viewBox={`0 0 1200 ${LAYERS_HEIGHT}`}
        width="100%"
        height={LAYERS_HEIGHT}
        preserveAspectRatio="xMidYMin slice"
      >
        <path d="M0 420 Q200 360 400 410 T800 400 T1200 420 L1200 900 L0 900 Z" fill="#8fc793" opacity="0.55" />
        <g transform="translate(150,250)" stroke="#7a8580" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5">
          <path d="M0 0 L0 -90" />
          <g className="pdpb-turbine">
            <path d="M0 -90 L-26 -70" />
            <path d="M0 -90 L26 -68" />
            <path d="M0 -90 L4 -50" />
          </g>
        </g>
        <g transform="translate(1000,320)" stroke="#7a8580" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.45">
          <path d="M0 0 L0 -70" />
          <g className="pdpb-turbine" style={{ animationDuration: "5s" }}>
            <path d="M0 -70 L-20 -55" />
            <path d="M0 -70 L20 -53" />
            <path d="M0 -70 L3 -38" />
          </g>
        </g>
      </svg>

      {/* Couche 3 — arbres, rivière, maison solaire, ruche. Vitesse moyenne. */}
      <svg
        data-speed="0.28"
        style={{ position: "absolute", top: 0, left: 0, width: "100%" }}
        viewBox={`0 0 1200 ${LAYERS_HEIGHT}`}
        width="100%"
        height={LAYERS_HEIGHT}
        preserveAspectRatio="xMidYMin slice"
      >
        <path d="M0 600 Q300 560 600 600 T1200 580" stroke="#6fae72" strokeWidth="2" fill="none" opacity="0.45" />
        <g transform="translate(950,900)" stroke="#a86b0a" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5">
          <path d="M-40 40 L0 5 L40 40 Z" />
          <rect x="-30" y="40" width="60" height="35" />
        </g>
        <g transform="translate(120,1400)" stroke="#1b5e20" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5">
          <path d="M0 60 L0 0" />
          <circle cx="0" cy="-24" r="30" />
        </g>
        <g transform="translate(1050,1900)" stroke="#e67e22" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5">
          <path d="M-15 0 L15 0 L19 13 L15 26 L-15 26 L-19 13 Z" />
          <path d="M-13 26 L13 26 L16 37 L-16 37 Z" />
        </g>
        <path d="M0 2500 Q300 2460 600 2500 T1200 2480" stroke="#6fae72" strokeWidth="2" fill="none" opacity="0.4" />
        <g transform="translate(200,3300)" stroke="#0b3c5d" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.45">
          <circle cx="-30" cy="22" r="20" />
          <circle cx="30" cy="22" r="20" />
          <path d="M-30 22 L0 -8 L30 22 M0 -8 L4 22 M0 -8 L-10 -16" />
        </g>
        <path d="M0 4200 Q300 4160 600 4200 T1200 4180" stroke="#6fae72" strokeWidth="2" fill="none" opacity="0.4" />
      </svg>

      {/* Couche 4 — premier plan : les animaux, proches de la vitesse du
          contenu, chacun avec sa propre micro-animation. */}
      <svg
        data-speed="0.5"
        style={{ position: "absolute", top: 0, left: 0, width: "100%" }}
        viewBox={`0 0 1200 ${LAYERS_HEIGHT}`}
        width="100%"
        height={LAYERS_HEIGHT}
        preserveAspectRatio="xMidYMin slice"
      >
        {/* Oiseaux */}
        <g className="pdpb-birds" stroke="#3d3d3a" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M250 180 Q262 165 274 180 Q286 165 298 180" />
          <path d="M300 160 Q310 148 320 160 Q330 148 340 160" />
          <path d="M200 210 Q210 198 220 210 Q230 198 240 210" />
        </g>

        {/* Abeille + fleur */}
        <g transform="translate(950,520)">
          <g stroke="#6c3483" strokeWidth="2" fill="none" opacity="0.6">
            <circle cx="0" cy="0" r="7" />
            <circle cx="12" cy="-5" r="7" />
            <circle cx="12" cy="9" r="7" />
            <circle cx="-12" cy="-5" r="7" />
            <circle cx="-12" cy="9" r="7" />
          </g>
          <g className="pdpb-bee" transform="translate(30,-20)">
            <ellipse cx="0" cy="0" rx="7" ry="5" fill="#f4b400" stroke="#1b1f23" strokeWidth="1" />
            <path d="M-7 0 L7 0" stroke="#1b1f23" strokeWidth="1" />
          </g>
        </g>

        {/* Cerf */}
        <g className="pdpb-deer" transform="translate(120,1250)" stroke="#6b4423" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M0 60 L0 20 M-14 60 L-14 25 M14 60 L14 25" />
          <ellipse cx="0" cy="10" rx="22" ry="14" />
          <path d="M18 0 L30 -10 M18 0 Q26 -20 34 -26 M18 0 Q10 -22 4 -30" />
        </g>

        {/* Ruisseau + canards */}
        <path d="M0 3320 Q300 3280 500 3330 T900 3320 Q1050 3315 1200 3350" stroke="#a8d4e6" strokeWidth="18" fill="none" opacity="0.7" />
        <g className="pdpb-ducks" transform="translate(430,3345)" stroke="#3d3d3a" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M-12 0 Q-12 -8 -4 -8 Q4 -8 4 0 Z" />
          <circle cx="6" cy="-9" r="4" />
        </g>
        <g className="pdpb-ducks" transform="translate(470,3355)" stroke="#3d3d3a" strokeWidth="2" fill="none" strokeLinecap="round" style={{ animationDelay: "-1.4s" }}>
          <path d="M-10 0 Q-10 -7 -3 -7 Q3 -7 3 0 Z" />
          <circle cx="5" cy="-8" r="3.5" />
        </g>

        {/* Feu de camp */}
        <g transform="translate(600,4600)">
          <path d="M-24 20 L-10 12 L10 12 L24 20 L20 26 L-20 26 Z" stroke="#5c4a3a" strokeWidth="2" fill="none" />
          <path
            className="pdpb-fire"
            d="M0 20 C-6 10 -8 0 0 -14 C8 0 6 10 0 20 Z"
            fill="#e67e22"
          />
          <path
            className="pdpb-fire"
            d="M0 16 C-3 8 -4 2 0 -6 C4 2 3 8 0 16 Z"
            fill="#f4b400"
            style={{ animationDelay: "-0.4s" }}
          />
        </g>
      </svg>

      <style jsx>{`
        .pdpb-cloud {
          animation: pdpb-drift 20s ease-in-out infinite alternate;
        }
        .pdpb-turbine {
          transform-origin: 0px -90px;
          animation: pdpb-spin 6s linear infinite;
        }
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
        @keyframes pdpb-drift {
          from { transform: translateX(0); }
          to { transform: translateX(40px); }
        }
        @keyframes pdpb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pdpb-fly {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(6px, -6px); }
        }
        @keyframes pdpb-buzz {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(4px, -3px); }
          50% { transform: translate(-3px, 2px); }
          75% { transform: translate(3px, 3px); }
        }
        @keyframes pdpb-sway {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(-1deg); }
        }
        @keyframes pdpb-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
        @keyframes pdpb-flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.95; }
          50% { transform: scaleY(1.15) scaleX(0.92); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
