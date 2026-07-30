import { useEffect, useRef } from "react";
import { useSobriety } from "../lib/SobrietyContext";

// Fond décoratif du site — scène en couches séparées (SVG), chaque couche
// défilant à sa propre vitesse au scroll (vrai parallax : ciel très lent,
// collines moyennes, premier plan proche de la vitesse du contenu).
//
// Les animaux (oiseaux, abeille, cerf, canards + eau, feu) sont au premier
// plan, chacun avec sa propre micro-animation en plus du parallax.
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
        opacity: 0.24,
      }}
    >
      {/* ====== Couche 1 — ciel : soleil, nuages, montagnes lointaines ====== */}
      <svg
        data-speed="0.04"
        style={{ position: "absolute", top: 0, left: 0, width: "100%" }}
        viewBox={`0 0 1200 ${LAYERS_HEIGHT}`}
        width="100%"
        height={LAYERS_HEIGHT}
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          <radialGradient id="pdpb-sun">
            <stop offset="0%" stopColor="#fff6d0" />
            <stop offset="55%" stopColor="#ffe58a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffe58a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pdpb-mtn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c3d3de" />
            <stop offset="100%" stopColor="#9bb8c9" />
          </linearGradient>
        </defs>

        <circle cx="1030" cy="120" r="150" fill="url(#pdpb-sun)" />
        <circle cx="1030" cy="120" r="48" fill="#fff2c2" />

        <g className="pdpb-cloud" fill="white">
          <ellipse cx="220" cy="100" rx="58" ry="26" />
          <ellipse cx="270" cy="88" rx="42" ry="22" />
          <ellipse cx="180" cy="92" rx="34" ry="18" />
        </g>
        <g className="pdpb-cloud" fill="white" style={{ animationDelay: "-9s" }}>
          <ellipse cx="740" cy="70" rx="46" ry="20" />
          <ellipse cx="778" cy="60" rx="30" ry="15" />
        </g>
        <g className="pdpb-cloud" fill="white" opacity="0.85" style={{ animationDelay: "-14s" }}>
          <ellipse cx="480" cy="900" rx="50" ry="22" />
          <ellipse cx="520" cy="888" rx="34" ry="17" />
        </g>
        <g className="pdpb-cloud" fill="white" opacity="0.85" style={{ animationDelay: "-4s" }}>
          <ellipse cx="900" cy="2700" rx="52" ry="24" />
          <ellipse cx="940" cy="2690" rx="36" ry="18" />
        </g>

        <path
          d="M0 340 C80 260 140 250 190 300 C230 220 280 180 330 260 C380 190 430 170 480 250
             C540 180 600 190 650 270 C710 200 770 210 820 280 C880 220 940 230 1000 290
             C1060 250 1120 260 1200 310 L1200 460 L0 460 Z"
          fill="url(#pdpb-mtn)"
        />
      </svg>

      {/* ====== Couche 2 — collines, montagnes proches, éoliennes, village ====== */}
      <svg
        data-speed="0.12"
        style={{ position: "absolute", top: 0, left: 0, width: "100%" }}
        viewBox={`0 0 1200 ${LAYERS_HEIGHT}`}
        width="100%"
        height={LAYERS_HEIGHT}
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          <linearGradient id="pdpb-mtn-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a9c0ad" />
            <stop offset="100%" stopColor="#8fae93" />
          </linearGradient>
          <linearGradient id="pdpb-hill1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9fd1a0" />
            <stop offset="100%" stopColor="#7fbf85" />
          </linearGradient>
        </defs>

        <path
          d="M0 380 C100 300 170 290 220 350 C260 280 320 250 380 330 C440 260 500 240 560 320
             C630 250 700 260 760 330 C830 270 900 280 960 340 C1030 290 1100 300 1200 350
             L1200 480 L0 480 Z"
          fill="url(#pdpb-mtn-near)"
        />
        <path d="M170 300 L220 350 L195 352 Z" fill="white" opacity="0.75" />
        <path d="M550 300 L560 320 L540 322 Z" fill="white" opacity="0.75" />

        <path d="M0 480 Q200 420 400 470 T800 460 T1200 480 L1200 900 L0 900 Z" fill="url(#pdpb-hill1)" />

        {/* Petit village au loin */}
        <g transform="translate(560,430)" opacity="0.8">
          <rect x="-8" y="-6" width="16" height="12" fill="#c9704f" />
          <path d="M-10 -6 L0 -14 L10 -6 Z" fill="#8a4a35" />
          <rect x="16" y="-4" width="14" height="10" fill="#d9a25f" />
          <path d="M14 -4 L23 -11 L32 -4 Z" fill="#8a4a35" />
          <rect x="-28" y="-3" width="14" height="9" fill="#c9704f" />
          <path d="M-30 -3 L-21 -10 L-12 -3 Z" fill="#8a4a35" />
        </g>

        {/* Éoliennes */}
        <g transform="translate(210,300)">
          <path d="M-5 0 L5 0 L2 150 L-2 150 Z" fill="#e6e9e7" stroke="#c3c9c6" strokeWidth="1" />
          <circle cx="0" cy="0" r="9" fill="#d6dbd8" stroke="#b0b6b3" strokeWidth="1.5" />
          <g className="pdpb-turbine" style={{ transformOrigin: "0px 0px" }}>
            <ellipse cx="0" cy="-40" rx="9" ry="40" fill="#f2f4f3" stroke="#c3c9c6" strokeWidth="1.5" />
            <ellipse cx="0" cy="-40" rx="9" ry="40" fill="#f2f4f3" stroke="#c3c9c6" strokeWidth="1.5" transform="rotate(120)" />
            <ellipse cx="0" cy="-40" rx="9" ry="40" fill="#f2f4f3" stroke="#c3c9c6" strokeWidth="1.5" transform="rotate(240)" />
          </g>
        </g>
        <g transform="translate(1010,380) scale(0.8)">
          <path d="M-5 0 L5 0 L2 140 L-2 140 Z" fill="#e6e9e7" stroke="#c3c9c6" strokeWidth="1" />
          <circle cx="0" cy="0" r="9" fill="#d6dbd8" stroke="#b0b6b3" strokeWidth="1.5" />
          <g className="pdpb-turbine" style={{ transformOrigin: "0px 0px", animationDuration: "5s" }}>
            <ellipse cx="0" cy="-38" rx="9" ry="38" fill="#f2f4f3" stroke="#c3c9c6" strokeWidth="1.5" />
            <ellipse cx="0" cy="-38" rx="9" ry="38" fill="#f2f4f3" stroke="#c3c9c6" strokeWidth="1.5" transform="rotate(120)" />
            <ellipse cx="0" cy="-38" rx="9" ry="38" fill="#f2f4f3" stroke="#c3c9c6" strokeWidth="1.5" transform="rotate(240)" />
          </g>
        </g>
        <g transform="translate(700,420) scale(0.55)">
          <path d="M-5 0 L5 0 L2 140 L-2 140 Z" fill="#e6e9e7" stroke="#c3c9c6" strokeWidth="1" />
          <circle cx="0" cy="0" r="9" fill="#d6dbd8" stroke="#b0b6b3" strokeWidth="1.5" />
          <g className="pdpb-turbine" style={{ transformOrigin: "0px 0px", animationDuration: "7s" }}>
            <ellipse cx="0" cy="-38" rx="9" ry="38" fill="#f2f4f3" stroke="#c3c9c6" strokeWidth="1.5" />
            <ellipse cx="0" cy="-38" rx="9" ry="38" fill="#f2f4f3" stroke="#c3c9c6" strokeWidth="1.5" transform="rotate(120)" />
            <ellipse cx="0" cy="-38" rx="9" ry="38" fill="#f2f4f3" stroke="#c3c9c6" strokeWidth="1.5" transform="rotate(240)" />
          </g>
        </g>
      </svg>

      {/* ====== Couche 3 — arbres, maison solaire, ruche, fleurs, rivières ====== */}
      <svg
        data-speed="0.28"
        style={{ position: "absolute", top: 0, left: 0, width: "100%" }}
        viewBox={`0 0 1200 ${LAYERS_HEIGHT}`}
        width="100%"
        height={LAYERS_HEIGHT}
        preserveAspectRatio="xMidYMin slice"
      >
        <path d="M0 700 Q300 660 600 700 T1200 680" stroke="#6fae72" strokeWidth="3" fill="none" opacity="0.6" />

        <g transform="translate(950,1000)">
          <path d="M-45 45 L0 5 L45 45 Z" fill="#b5563a" />
          <rect x="-32" y="45" width="64" height="40" fill="#e8d4b0" />
          <rect x="5" y="15" width="26" height="12" fill="#4a6b8a" transform="skewX(-12)" />
        </g>

        <g transform="translate(140,1500)">
          <path d="M0 70 L0 0" stroke="#6b4423" strokeWidth="6" strokeLinecap="round" />
          <circle cx="0" cy="-24" r="34" fill="#4a9950" />
          <circle cx="-22" cy="0" r="24" fill="#57a95d" />
          <circle cx="22" cy="0" r="24" fill="#57a95d" />
        </g>
        <g transform="translate(760,1550) scale(0.7)">
          <path d="M0 70 L0 0" stroke="#6b4423" strokeWidth="6" strokeLinecap="round" />
          <circle cx="0" cy="-24" r="34" fill="#57a95d" />
          <circle cx="-22" cy="0" r="24" fill="#4a9950" />
          <circle cx="22" cy="0" r="24" fill="#4a9950" />
        </g>

        <g transform="translate(1050,2000)">
          <rect x="-18" y="10" width="36" height="16" fill="#e8b46a" rx="3" />
          <rect x="-18" y="26" width="36" height="16" fill="#d99a4a" rx="3" />
          <rect x="-20" y="42" width="40" height="10" fill="#c07f2f" rx="2" />
        </g>

        {/* Petites fleurs décoratives sur les collines */}
        <g fill="#e67e22" opacity="0.7">
          <circle cx="100" cy="1150" r="6" /><circle cx="120" cy="1160" r="5" /><circle cx="90" cy="1170" r="5" />
        </g>
        <g fill="#8e44ad" opacity="0.7">
          <circle cx="900" cy="1750" r="6" /><circle cx="920" cy="1760" r="5" /><circle cx="880" cy="1765" r="5" />
        </g>

        <path d="M0 2600 Q300 2560 600 2600 T1200 2580" stroke="#6fae72" strokeWidth="3" fill="none" opacity="0.5" />
        <g transform="translate(220,3350)">
          <circle cx="-24" cy="20" r="16" fill="none" stroke="#0b3c5d" strokeWidth="3" />
          <circle cx="24" cy="20" r="16" fill="none" stroke="#0b3c5d" strokeWidth="3" />
          <path d="M-24 20 L0 -6 L24 20 M0 -6 L3 20 M0 -6 L-8 -12" stroke="#0b3c5d" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
        <path d="M0 4300 Q300 4260 600 4300 T1200 4280" stroke="#6fae72" strokeWidth="3" fill="none" opacity="0.5" />

        <g transform="translate(300,4700)" opacity="0.85">
          <path d="M0 60 L0 0" stroke="#6b4423" strokeWidth="5" strokeLinecap="round" />
          <circle cx="0" cy="-20" r="28" fill="#4a9950" />
        </g>
        <g transform="translate(850,4900) scale(0.8)" opacity="0.85">
          <path d="M0 60 L0 0" stroke="#6b4423" strokeWidth="5" strokeLinecap="round" />
          <circle cx="0" cy="-20" r="28" fill="#57a95d" />
        </g>
      </svg>

      {/* ====== Couche 4 — premier plan : les animaux ====== */}
      <svg
        data-speed="0.5"
        style={{ position: "absolute", top: 0, left: 0, width: "100%" }}
        viewBox={`0 0 1200 ${LAYERS_HEIGHT}`}
        width="100%"
        height={LAYERS_HEIGHT}
        preserveAspectRatio="xMidYMin slice"
      >
        {/* Oiseaux — trois tailles pour la profondeur */}
        <g className="pdpb-birds" stroke="#3d3d3a" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M280 300 Q305 272 330 295 Q335 288 340 292 Q336 298 340 302 Q336 300 330 295 Q355 272 380 300" />
        </g>
        <g className="pdpb-birds" stroke="#3d3d3a" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.85" transform="translate(-90,-30) scale(0.75)" style={{ animationDelay: "-0.6s" }}>
          <path d="M280 300 Q305 272 330 295 Q335 288 340 292 Q336 298 340 302 Q336 300 330 295 Q355 272 380 300" />
        </g>
        <g className="pdpb-birds" stroke="#3d3d3a" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.65" transform="translate(70,45) scale(0.55)" style={{ animationDelay: "-1.2s" }}>
          <path d="M280 300 Q305 272 330 295 Q335 288 340 292 Q336 298 340 302 Q336 300 330 295 Q355 272 380 300" />
        </g>

        {/* Fleur + abeille */}
        <g transform="translate(950,750)">
          <g stroke="#8e44ad" strokeWidth="2" fill="#c39bd3">
            <ellipse cx="0" cy="-16" rx="9" ry="14" />
            <ellipse cx="15" cy="-5" rx="9" ry="14" transform="rotate(72 15 -5)" />
            <ellipse cx="9" cy="13" rx="9" ry="14" transform="rotate(144 9 13)" />
            <ellipse cx="-9" cy="13" rx="9" ry="14" transform="rotate(216 -9 13)" />
            <ellipse cx="-15" cy="-5" rx="9" ry="14" transform="rotate(288 -15 -5)" />
          </g>
          <circle cx="0" cy="0" r="9" fill="#f4b400" stroke="#a86b0a" strokeWidth="1.5" />
          <path d="M0 40 L0 5" stroke="#4a9950" strokeWidth="3" strokeLinecap="round" />

          <g className="pdpb-bee" transform="translate(38,-30)">
            <ellipse cx="8" cy="-3" rx="9" ry="6" fill="white" opacity="0.7" transform="rotate(-20 8 -3)" />
            <ellipse cx="8" cy="3" rx="9" ry="6" fill="white" opacity="0.7" transform="rotate(20 8 3)" />
            <ellipse cx="0" cy="0" rx="8" ry="6" fill="#f4b400" stroke="#1b1f23" strokeWidth="1.2" />
            <path d="M-6 -2 L6 -2 M-6 2 L6 2" stroke="#1b1f23" strokeWidth="1.2" />
          </g>
        </g>

        {/* Cerf */}
        <g className="pdpb-deer" transform="translate(110,1450)" fill="#8a5a2b">
          <path d="M-20 60 L-20 25 L-14 25 L-14 60 Z" />
          <path d="M14 60 L14 25 L20 25 L20 60 Z" />
          <path d="M-40 40 L-32 15 L-38 40 Z" />
          <path d="M32 40 L38 15 L40 40 Z" />
          <ellipse cx="0" cy="15" rx="34" ry="20" />
          <path d="M-25 -5 Q-30 -25 -20 -35 Q-15 -25 -18 -8 Z" />
          <ellipse cx="-25" cy="-15" rx="12" ry="15" />
          <path d="M-32 -25 Q-40 -40 -34 -50 M-32 -25 Q-24 -42 -18 -46" stroke="#6b4423" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>

        {/* Ruisseau + canards */}
        <path d="M0 2100 Q300 2060 500 2100 T900 2090 Q1050 2085 1200 2110" stroke="#a8d4e6" strokeWidth="20" fill="none" opacity="0.85" />
        <g className="pdpb-ducks" transform="translate(430,2100)" fill="#3d3d3a">
          <path d="M-14 0 Q-14 -10 -4 -10 Q8 -10 8 -2 Q6 4 -6 4 Z" />
          <circle cx="7" cy="-10" r="4.5" />
        </g>
        <g className="pdpb-ducks" transform="translate(475,2108)" fill="#5a4a3a" style={{ animationDelay: "-1.4s" }}>
          <path d="M-12 0 Q-12 -9 -3 -9 Q7 -9 7 -2 Q5 3 -5 3 Z" />
          <circle cx="6" cy="-9" r="4" />
        </g>

        {/* Feu de camp */}
        <g transform="translate(600,4600)">
          <path d="M-24 20 L-10 10 L10 10 L24 20 L20 26 L-20 26 Z" fill="#5c4a3a" />
          <path className="pdpb-fire" d="M0 20 C-8 8 -10 -4 0 -22 C10 -4 8 8 0 20 Z" fill="#e67e22" />
          <path className="pdpb-fire" d="M0 15 C-4 6 -5 -2 0 -12 C5 -2 4 6 0 15 Z" fill="#f4b400" style={{ animationDelay: "-0.4s" }} />
        </g>
      </svg>

      <style jsx>{`
        .pdpb-cloud {
          animation: pdpb-drift 20s ease-in-out infinite alternate;
        }
        .pdpb-turbine {
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
