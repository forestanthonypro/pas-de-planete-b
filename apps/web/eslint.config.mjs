import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      // Cette règle cible un vrai anti-pattern (dériver un état qui aurait
      // dû être calculé pendant le rendu), mais elle ne distingue pas ce
      // cas du pattern standard "démarrer un chargement puis appeler une
      // API dans un effet" — l'usage canonique et documenté de useEffect
      // pour synchroniser avec un système externe (le réseau). Ce projet
      // utilise ce second pattern de façon délibérée et cohérente dans la
      // quasi-totalité des pages qui chargent des données ; désactivée ici
      // plutôt que de semer des dizaines de suppressions ligne par ligne.
      // Piste d'amélioration future : un hook partagé useApiFetch() qui
      // centraliserait ce pattern une bonne fois pour toutes.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
