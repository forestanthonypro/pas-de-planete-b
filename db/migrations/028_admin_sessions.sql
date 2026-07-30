-- Sessions admin créées après vérification d'un code TOTP (Google
-- Authenticator, Authy...) — remplace le jeton statique partagé pour toutes
-- les routes d'administration de contenu (pas les routes d'ingestion
-- automatisée CI/CD, qui gardent INGEST_TOKEN).
CREATE TABLE IF NOT EXISTS admin_sessions (
    session_token TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at);
