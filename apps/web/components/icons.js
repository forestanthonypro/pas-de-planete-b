// Pictogrammes en SVG inline, style trait épuré (cohérent avec la maquette) —
// aucune police d'icônes à télécharger, aucune requête réseau supplémentaire,
// juste du balisage. Chaque icône accepte `size` (px) et hérite la couleur
// du texte environnant via currentColor.

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Svg({ size = 20, children, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      {children}
    </svg>
  );
}

export function IconCloud(props) {
  return (
    <Svg {...props}>
      <path d="M7 18a4 4 0 1 1 .7-7.94A5.5 5.5 0 0 1 18 12.5 3.5 3.5 0 0 1 17.5 18Z" />
    </Svg>
  );
}

export function IconBolt(props) {
  return (
    <Svg {...props}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </Svg>
  );
}

export function IconDroplet(props) {
  return (
    <Svg {...props}>
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
    </Svg>
  );
}

export function IconTree(props) {
  return (
    <Svg {...props}>
      <path d="M12 3 7 10h2l-4 6h5v5h4v-5h5l-4-6h2Z" />
    </Svg>
  );
}

export function IconPaw(props) {
  return (
    <Svg {...props}>
      <circle cx="7" cy="9" r="1.6" />
      <circle cx="12" cy="6.5" r="1.6" />
      <circle cx="17" cy="9" r="1.6" />
      <path d="M8.5 13.5c0-2 1.6-3 3.5-3s3.5 1 3.5 3-1.9 4-3.5 4-3.5-2-3.5-4Z" />
    </Svg>
  );
}

export function IconFlame(props) {
  return (
    <Svg {...props}>
      <path d="M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c1.2 1 2 2.7 2 4.5A6 6 0 0 1 6 13.5C6 9 9 7 12 2Z" />
    </Svg>
  );
}

export function IconSmog(props) {
  return (
    <Svg {...props}>
      <path d="M4 9h9" />
      <path d="M4 13h13a3 3 0 1 0-2.4-4.8" />
      <path d="M4 17h9" />
    </Svg>
  );
}

export function IconUsers(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 8.2A3 3 0 1 1 17 14" />
      <path d="M16.5 14.5c2.3.4 3.5 2 3.5 4.5" />
    </Svg>
  );
}

export function IconLandmark(props) {
  return (
    <Svg {...props}>
      <path d="M4 10h16" />
      <path d="M12 3 20 10H4Z" />
      <path d="M6 10v9M11 10v9M13 10v9M18 10v9" />
      <path d="M4 21h16" />
    </Svg>
  );
}

export function IconScale(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v18M8 21h8" />
      <path d="M5 7h6M13 7h6" />
      <path d="M5 7 2.5 12a2.5 2.5 0 0 0 5 0Z" />
      <path d="M19 7l-2.5 5a2.5 2.5 0 0 0 5 0Z" />
    </Svg>
  );
}

export function IconSearch(props) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </Svg>
  );
}

export function IconLeaf(props) {
  return (
    <Svg {...props}>
      <path d="M4 20c8 0 16-6 16-16C10 4 4 12 4 20Z" />
      <path d="M4 20c3-5 6-8 12-11" />
    </Svg>
  );
}

export function IconCheck(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </Svg>
  );
}
