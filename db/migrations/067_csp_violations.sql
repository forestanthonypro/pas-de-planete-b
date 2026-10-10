-- Persiste les rapports de violation CSP (POST /api/csp-report) en base.
-- Jusqu'ici, ils n'étaient que journalisés via console.warn("CSP_VIOLATION",
-- ...) — un simple redéploiement (docker compose up -d) remplace le
-- conteneur api et fait disparaître tout l'historique des logs avec lui.
-- Ça rend impossible de tenir la fenêtre d'observation de 7 jours sans
-- violation exigée par CSP_ROLLOUT.md avant de passer la CSP en mode
-- bloquant. Cette table survit aux redéploiements.
CREATE TABLE IF NOT EXISTS csp_violations (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_uri TEXT,
  violated_directive TEXT,
  document_uri TEXT,
  user_agent TEXT,
  report JSONB NOT NULL
);

-- La dashboard de monitoring (voir plus bas) liste surtout les violations
-- récentes groupées par directive : cet index couvre ce tri sans scan complet
-- une fois la table grossie sur plusieurs semaines d'observation.
CREATE INDEX IF NOT EXISTS idx_csp_violations_received_at
  ON csp_violations (received_at DESC);
