import { Component } from "react";

// Générique, minimal : évite qu'un rendu enfant imprévu (ex. aperçu d'un
// graphique construit à partir d'un JSON collé par l'admin, syntaxiquement
// valide mais structurellement inattendu) ne fasse planter toute la page.
// Utilisation : <ErrorBoundary fallback={<p>...</p>}>{children}</ErrorBoundary>
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    // Réarme dès que le contenu surveillé change (ex. nouvel aperçu tenté
    // après correction du JSON) — sinon l'état d'erreur resterait figé.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}
