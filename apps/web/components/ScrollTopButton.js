import { useEffect, useState } from "react";

// Bouton flottant "retour en haut" — apparaît après un défilement de 400px,
// remonte en douceur au clic. Respecte prefers-reduced-motion (comme le
// reste du site) en passant en défilement instantané si activé.
export default function ScrollTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToTop() {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Remonter en haut de la page"
      title="Remonter en haut de la page"
      style={{
        position: "fixed",
        right: "24px",
        bottom: "24px",
        width: "44px",
        height: "44px",
        borderRadius: "50%",
        border: "1px solid var(--color-bordure)",
        background: "var(--color-carte)",
        color: "var(--color-texte)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.12)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 0.25s ease, transform 0.25s ease, box-shadow 0.2s ease",
        zIndex: 40,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.18)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.12)";
        e.currentTarget.style.transform = visible ? "translateY(0)" : "translateY(12px)";
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M12 19V5M12 5L6 11M12 5L18 11"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
